const { getSettings } = require('./tradogram.settings')
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

// Tradogram exposes names/numbers, not an accounting category. Only explicit
// Loan/Inventory names are eligible; never infer a category from an account number.
function accountType(name) {
  if (/\baccounts?\s+payable\b|\bpayables?\b/i.test(name)) return ''
  const loan = /\bloans?\b/i.test(name)
  const inventory = /\binventory\b/i.test(name)
  return loan !== inventory ? loan ? 'loan' : 'inventory' : ''
}

async function listGLAccounts() {
  const all = []
  const seen = new Set()
  for (let page = 1; page <= 1000; page++) {
    const body = await get('/gl_accounts', { page: String(page), pageSize: '100', isActive: 'true' })
    if (!Array.isArray(body.GLAccounts)) throw error('Tradogram response is missing GLAccounts.', 502)
    for (const raw of body.GLAccounts) {
      if (!raw.GLAccountCode || seen.has(raw.GLAccountCode)) throw error('Tradogram repeated GL accounts while paging. Retry before selecting an account.', 502)
      seen.add(raw.GLAccountCode)
      const name = String(raw.GLAccountName || '').trim()
      const number = String(raw.GLAccountNumber || '').trim()
      const type = accountType(name)
      if (raw.IsActive === true && type && number) all.push({ code: raw.GLAccountCode, name, number, type })
    }
    if (body.HasMorePages === false || (body.HasMorePages !== true && body.GLAccounts.length < 100)) {
      return all.sort((a, b) => a.name.localeCompare(b.name) || a.number.localeCompare(b.number))
    }
  }
  throw error('The Tradogram GL account list is incomplete. Retry before selecting an account.', 502)
}

function validateSiteAccounts(config, accounts) {
  for (const type of ['loan', 'inventory']) {
    const number = config[`${type}AccountId`]
    if (!number) continue
    const matches = accounts.filter((a) => a.number === number && a.type === type)
    if (matches.length !== 1) throw error(`Select a unique active ${type} account from Tradogram for this site.`, 422)
  }
}

function normalize(d, po, supplier = null) {
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
      poGLAccountName: item?.GLAccountName || '',
      poGLAccountNumber: String(item?.GLAccountNumber || '').trim(),
    }
  }).filter((line) => line.quantity > 0)
  if (!lines.length) issues.push('There are no received quantities to prepare.')
  if (d.IsBooked !== true || !d.ReceiveDate) issues.push('The delivery must be booked as received in Tradogram.')
  if (!['In Delivery', 'Fully Received', 'Closed'].includes(d.POStatus)) issues.push('The PO must be In Delivery, Fully Received, or Closed.')
  if (!po.Currency) issues.push('The PO currency is missing.')
  const source = {
    ...summary(d), poCode: d.POCode, currency: po.Currency || '', booked: d.IsBooked === true,
    supplierCode: supplier?.SupplierCode || po.SupplierCode || '',
    // Prefer the current supplier master over copied PO/delivery references.
    // If the master exists but its account is blank, do not reuse a stale number.
    supplierAccountNumber: String(supplier ? supplier.AccountNumber || '' : po.SupplierAccountNumber || d.SupplierAccount || '').trim(),
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
  let supplier = null
  if (po.SupplierCode) {
    if (!codePattern.test(po.SupplierCode)) throw error('The PO has no valid supplier link.', 422)
    const supplierBody = await get(`/suppliers/${po.SupplierCode}`)
    supplier = supplierBody.Suppliers?.find((s) => s.SupplierCode === po.SupplierCode)
    if (!supplier) throw error('The Tradogram supplier could not be loaded.', 422)
  }
  return normalize(delivery, po, supplier)
}

function prepare(source, input, config, accounts = []) {
  const issues = [...source.issues]
  if (!input.site) issues.push('Choose the receiving site.')
  if (!config) issues.push('Save account settings for this site.')
  if (!source.supplierAccountNumber) issues.push('Set the supplier account number in Tradogram to its Intacct vendor ID.')
  const choices = new Map((input.lines || []).map((line) => [line.id, line]))
  if ((input.lines || []).some((line) => !source.lines.some((s) => s.id === line.id))) throw error('Selections contain a line outside this delivery.')
  const lines = source.lines.map((line) => {
    const choice = choices.get(line.id)
    // Existing drafts stored only Loan/Inventory. Resolve those through the
    // site's saved default; an explicit but stale selection must never fall back.
    const candidates = choice?.glAccountCode
      ? accounts.filter((a) => a.code === choice.glAccountCode)
      : choice?.accountType ? accounts.filter((a) => a.type === choice.accountType && a.number === config?.[`${choice.accountType}AccountId`]) : []
    const account = candidates.length === 1 ? candidates[0] : null
    if (!account) issues.push(`Choose a unique active Loan or Inventory GL account from Tradogram for ${line.name}.`)
    return { ...line, accountType: account?.type || '', accountId: account?.number || '',
      glAccountCode: choice?.glAccountCode || account?.code || '', accountName: account?.name || '' }
  })
  return { lines, issues: [...new Set(issues)], subtotal: source.subtotal, credit: 'Accounts Payable', configHash: hash(config ? {
    site: config.site, entityId: getSettings().entityId, loanAccountId: config.loanAccountId, inventoryAccountId: config.inventoryAccountId,
    selectedAccounts: lines.map((line) => ({ code: line.glAccountCode, name: line.accountName, number: line.accountId, type: line.accountType })),
  } : null) }
}

module.exports = { listDeliveries, loadDelivery, listGLAccounts, validateSiteAccounts, accountType, normalize, prepare, summary, error }
