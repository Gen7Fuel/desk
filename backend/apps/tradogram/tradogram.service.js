const { createHash } = require('node:crypto')

const BASE = 'https://api.tradogram.com/v1.0.4'
const codePattern = /^[A-Za-z0-9]{12}$/
const error = (message, status = 400) => Object.assign(new Error(message), { status })
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100

async function get(path, parameters = {}) {
  const token = process.env.TRADOGRAM_API_KEY?.trim()
  if (!token) throw error('Tradogram API key is not configured on the server.', 503)
  const url = new URL(BASE + path)
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value)
  let response
  try {
    response = await fetch(url, {
      headers: { 'x-api-key': Buffer.from(token).toString('base64') },
      signal: AbortSignal.timeout(20000),
    })
  } catch { throw error('Could not reach Tradogram. Please retry.', 502) }
  if (!response.ok) throw error(`Tradogram returned HTTP ${response.status}. Check API access and retry.`, 502)
  const body = await response.json().catch(() => null)
  if (!body || typeof body !== 'object') throw error('Tradogram returned an invalid response.', 502)
  return body
}

async function listDeliveries(page = 1) {
  const body = await get('/deliveries', {
    page: String(page), pageSize: '100', fetchType: 'Both', updateFetchFlag: 'false',
    status: 'In Delivery,Fully Received,Closed',
  })
  if (!Array.isArray(body.Deliveries)) throw error('Tradogram response is missing Deliveries.', 502)
  return {
    deliveries: body.Deliveries.map(summary), page,
    hasMore: typeof body.HasMorePages === 'boolean' ? body.HasMorePages : body.Deliveries.length >= 100,
  }
}

function summary(d) {
  return {
    deliveryCode: d.DeliveryCode, poNumber: d.PONumber || d.POName || d.POCode,
    supplier: d.SupplierName, location: d.DeliveryLocationName || d.BuyerBranchName || '',
    receivedDate: d.ReceiveDate || '', poStatus: d.POStatus || '',
    invoiceNumber: d.InvoiceNumber || d.BillNumber || '', modifiedDate: d.ModifiedDate || '',
    receivedLines: (d.DeliveryItems || []).filter((line) => Number(line.QtyReceived) > 0).length,
  }
}

function normalize(d, po) {
  const issues = []
  const seen = new Set()
  const lines = (d.DeliveryItems || []).map((line) => {
    const item = (po.LineItems || []).find((p) => p.LineItemCode === line.LineItemCode)
    const quantity = Number(line.QtyReceived)
    const unitPrice = item?.UnitPrice !== '' && item?.UnitPrice != null ? Number(item.UnitPrice) : NaN
    if (!line.DeliveryItemCode || seen.has(line.DeliveryItemCode)) issues.push('Delivery line identifiers are missing or duplicated.')
    seen.add(line.DeliveryItemCode)
    if (!Number.isFinite(quantity) || quantity < 0) issues.push(`Invalid received quantity: ${line.ItemName || line.DeliveryItemCode}.`)
    if (quantity > 0 && (!item || !Number.isFinite(unitPrice) || unitPrice < 0)) issues.push(`Missing PO price for ${line.ItemName || line.DeliveryItemCode}.`)
    return {
      id: line.DeliveryItemCode, poLineCode: line.LineItemCode, name: line.ItemName || '',
      description: item?.ItemDescription || '', itemNumber: line.ItemNumber || '',
      quantity: Number.isFinite(quantity) ? quantity : 0, ordered: Number(line.QtyOrdered) || 0,
      unit: line.UOM || '', unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
      amount: Number.isFinite(quantity) && Number.isFinite(unitPrice) ? money(quantity * unitPrice) : null,
      department: line.DepartmentNumber || item?.DepartmentNumber || '',
    }
  }).filter((line) => line.quantity > 0)
  if (!lines.length) issues.push('There are no received quantities to prepare.')
  if (d.IsBooked !== true || !d.ReceiveDate) issues.push('The delivery must be booked as received in Tradogram.')
  if (!['In Delivery', 'Fully Received', 'Closed'].includes(d.POStatus)) issues.push('The PO must be In Delivery, Fully Received, or Closed.')
  if (!po.Currency) issues.push('The PO currency is missing.')
  const source = {
    ...summary(d), poCode: d.POCode, currency: po.Currency || '', booked: d.IsBooked === true,
    lines, issues, subtotal: money(lines.reduce((sum, line) => sum + (line.amount || 0), 0)),
    poTax: po.TaxTotal || '0', poDiscount: po.DiscountTotal || '0', poFees: po.FeesTotal || '0',
  }
  return { ...source, sourceHash: hash(source) }
}

async function loadDelivery(code) {
  if (!codePattern.test(code)) throw error('Invalid Tradogram delivery code.')
  const body = await get(`/deliveries/${code}`, { fetchType: 'Both', updateFetchFlag: 'false' })
  const delivery = body.Deliveries?.find((d) => d.DeliveryCode === code)
  if (!delivery) throw error('Delivery was not found in Tradogram.', 404)
  if (!codePattern.test(delivery.POCode || '')) throw error('Delivery has no valid PO link.', 422)
  const poBody = await get(`/purchase_orders/${delivery.POCode}`, { fetchType: 'Both', updateFetchFlag: 'false' })
  const po = poBody.PurchaseOrders?.find((p) => p.POCode === delivery.POCode)
  if (!po) throw error('The delivery purchase order could not be loaded.', 422)
  return normalize(delivery, po)
}

function prepare(source, input, config) {
  const issues = [...source.issues]
  if (!input.site) issues.push('Choose the receiving site.')
  if (!config) issues.push('Save account settings for this site.')
  if (!config?.sageLocationId) issues.push('Configure the site Intacct location/entity ID.')
  if (!input.vendorId) issues.push('Enter the Intacct supplier/vendor ID.')
  const choices = new Map((input.lines || []).map((line) => [line.id, line.accountType]))
  if ((input.lines || []).some((line) => !source.lines.some((s) => s.id === line.id))) throw error('Selections contain a line outside this delivery.')
  const lines = source.lines.map((line) => {
    const accountType = choices.get(line.id) || ''
    const accountId = accountType === 'loan' ? config?.loanAccountId : accountType === 'inventory' ? config?.inventoryAccountId : ''
    if (!['loan', 'inventory'].includes(accountType)) issues.push(`Choose Loan or Inventory for ${line.name}.`)
    else if (!accountId) issues.push(`Configure the ${accountType} account for ${input.site}.`)
    return { ...line, accountType, accountId: accountId || '' }
  })
  return { lines, issues: [...new Set(issues)], subtotal: source.subtotal, credit: 'Accounts Payable', configHash: hash(config ? {
    site: config.site, sageLocationId: config.sageLocationId, loanAccountId: config.loanAccountId, inventoryAccountId: config.inventoryAccountId,
  } : null) }
}

module.exports = { listDeliveries, loadDelivery, normalize, prepare, summary, error }
