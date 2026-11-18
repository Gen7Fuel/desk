const crypto = require('node:crypto')
const http = require('node:http')
const https = require('node:https')

const PAGE_SIZE = 25
const error = (message, status = 502) => Object.assign(new Error(message), { status })

function createToken(publicKey, privateKey, now = new Date()) {
  const key = Buffer.alloc(32)
  Buffer.from(privateKey, 'utf8').copy(key, 0, 0, 32)
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, key.subarray(0, 16))
  return Buffer.concat([cipher.update(publicKey + timestamp, 'utf8'), cipher.final()]).toString('base64')
}

function createClient({ baseUrl, publicKey, privateKey, timeoutMs = 15000, allowHttp = false }) {
  let base
  try { base = new URL(baseUrl) } catch { throw error('Bookworks connection is not configured.', 503) }
  if ((!allowHttp && base.protocol !== 'https:') || !['http:', 'https:'].includes(base.protocol) || base.username || base.password || !publicKey || !privateKey) {
    throw error('Bookworks connection is not configured.', 503)
  }

  // Node's HTTP client preserves the documented GET request body. Browser
  // fetch cannot send one. Never forward upstream bodies or credentials on errors.
  const read = (endpoint, criteria) => new Promise((resolve, reject) => {
    const body = JSON.stringify(criteria)
    const transport = base.protocol === 'https:' ? https : http
    const request = transport.request(new URL(base.pathname.replace(/\/$/, '') + endpoint, base), {
      method: 'GET',
      headers: {
        APIKey: createToken(publicKey, privateKey),
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, response => {
      const chunks = []
      let bytes = 0
      response.on('data', chunk => {
        bytes += chunk.length
        if (bytes > 2 * 1024 * 1024) return request.destroy(error('Bookworks returned an oversized response.'))
        chunks.push(chunk)
      })
      response.on('error', () => reject(error('Could not read the Bookworks response.')))
      response.on('end', () => {
        const status = response.statusCode
        if (status === 401 || status === 403) return reject(error('Bookworks rejected the configured API credentials. Contact an administrator.'))
        if (status === 429) return reject(error('Bookworks is busy. Please retry shortly.', 503))
        if (status !== 200) return reject(error('Bookworks could not complete the invoice lookup. Please retry.'))
        try {
          const rows = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          // The deployed Bookworks server returns JSON null for no matches.
          if (rows === null) return resolve([])
          if (!Array.isArray(rows)) throw new Error()
          resolve(rows)
        } catch { reject(error('Bookworks returned an unexpected response.')) }
      })
    })
    // Bound the whole request, including a stalled response body.
    const timer = setTimeout(() => request.destroy(error('Bookworks timed out. Please retry.', 504)), timeoutMs)
    request.on('close', () => clearTimeout(timer))
    request.on('error', err => reject(err.status ? err : error('Could not connect to Bookworks. Please retry.')))
    request.end(body)
  })

  return { read }
}

const string = value => typeof value === 'string' ? value : null
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null

function normalizeInvoice(row) {
  if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || typeof row.invoiceNumber !== 'string') {
    throw error('Bookworks returned an unexpected invoice.')
  }
  return {
    id: row.id, invoiceNumber: row.invoiceNumber, vendorCode: string(row.vendorCode), vendorName: null,
    invoiceDate: string(row.invoiceDate), dueDate: string(row.dueDate), discountDate: string(row.discountDate),
    description: string(row.description), totalAmount: number(row.totalAmount),
    posted: typeof row.posted === 'boolean' ? row.posted : null,
    distributions: (Array.isArray(row.distributions) ? row.distributions : []).map(line => ({
      glAccountCode: string(line?.glAccountCode), costCenterCode: string(line?.costCenterCode),
      debitOrCredit: string(line?.debitOrCredit), description: string(line?.description), amount: number(line?.amount),
    })),
  }
}

async function searchInvoices(invoiceNumber, offset = 0, client) {
  if (typeof invoiceNumber !== 'string' || !invoiceNumber.trim() || invoiceNumber.trim().length > 100) {
    throw error('Enter an invoice number of up to 100 characters.', 400)
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw error('Invalid invoice page.', 400)
  const query = invoiceNumber.trim()
  client ||= createClient({
    baseUrl: process.env.BOOKWORKS_API_URL,
    publicKey: process.env.BOOKWORKS_PUBLIC_KEY,
    privateKey: process.env.BOOKWORKS_PRIVATE_KEY,
  })
  const rows = await client.read('/api/v1/vendor/invoices', { invoiceNumbers: [query], limit: PAGE_SIZE, offset })
  if (rows.length > PAGE_SIZE) throw error('Bookworks returned an unexpected invoice page.')
  const invoices = rows.map(normalizeInvoice)
  if (invoices.some(row => row.invoiceNumber.toLowerCase() !== query.toLowerCase())) {
    throw error('Bookworks returned invoices that do not match the requested number.')
  }
  const warnings = []
  const codes = [...new Set(invoices.map(row => row.vendorCode).filter(Boolean))]
  if (codes.length) {
    try {
      const vendors = await client.read('/api/v1/vendors', { codes, limit: 50, offset: 0 })
      const names = new Map(vendors.filter(v => typeof v?.code === 'string').map(v => [v.code.toLowerCase(), string(v.name)]))
      for (const invoice of invoices) invoice.vendorName = names.get(invoice.vendorCode?.toLowerCase()) || null
      if (invoices.some(row => row.vendorCode && !row.vendorName)) warnings.push('Some vendor names were unavailable. Vendor codes are shown instead.')
    } catch { warnings.push('Vendor names could not be loaded. Invoice details are available using vendor codes.') }
  }
  return { invoiceNumber: query, offset, pageSize: PAGE_SIZE, hasMore: rows.length === PAGE_SIZE, invoices, warnings }
}

async function loadInvoice(id, client) {
  if (!Number.isSafeInteger(id) || id < 1) throw error('Invalid Bookworks invoice ID.', 400)
  client ||= createClient({ baseUrl: process.env.BOOKWORKS_API_URL, publicKey: process.env.BOOKWORKS_PUBLIC_KEY, privateKey: process.env.BOOKWORKS_PRIVATE_KEY })
  const rows = await client.read('/api/v1/vendor/invoices', { vendorInvoiceIDs: [id], limit: 1, offset: 0 })
  if (!rows.length) throw error('Bookworks invoice not found.', 404)
  if (rows.length !== 1 || rows[0].id !== id) throw error('Bookworks returned an unexpected invoice reference.')
  return normalizeInvoice(rows[0])
}

module.exports = { searchInvoices, loadInvoice, createClient, createToken, PAGE_SIZE }
