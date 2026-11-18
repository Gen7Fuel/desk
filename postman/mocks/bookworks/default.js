// Synthetic Bookworks AP responses based on its published OpenAPI contract.
// This fixture has no production credentials or real invoice/customer data.
const http = require('node:http')
const crypto = require('node:crypto')
const PUBLIC_KEY = 'fixture-public-key'
const PRIVATE_KEY = 'fixture-private-key-32-bytes-0000'
const invoice = (id = 101, vendorCode = 'EXAMPLE') => ({
  id, vendorCode, invoiceNumber: 'TEST-100', invoiceDate: '2026-10-20T00:00:00',
  dueDate: '2026-10-28T00:00:00', discountDate: null, description: 'Supplier Invoice',
  totalAmount: 123.45, posted: true,
  distributions: [{ glAccountCode: '12000', costCenterCode: 'EXAMPLE', debitOrCredit: 'Debit', description: 'Inventory', amount: 123.45 }],
})

function createHandler(state = {}) {
  return (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
    if (req.method !== 'GET' || !['/api/v1/vendor/invoices', '/api/v1/vendors'].includes(pathname)) return send(501, {})
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      let criteria
      try { criteria = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return send(400, {}) }
      state.requests?.push({ method: req.method, pathname, criteria })
      try {
        const key = Buffer.alloc(32)
        Buffer.from(PRIVATE_KEY).copy(key, 0, 0, 32)
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, key.subarray(0, 16))
        const plaintext = Buffer.concat([decipher.update(Buffer.from(req.headers.apikey || '', 'base64')), decipher.final()]).toString('utf8')
        if (!plaintext.startsWith(PUBLIC_KEY) || !/^\d{14}$/.test(plaintext.slice(PUBLIC_KEY.length))) return send(401, {})
      } catch { return send(401, {}) }
      if (state.mode === 'unauthorized') return send(401, { message: 'Private upstream diagnostic must not escape' })
      if (state.mode === 'server') return send(500, { message: 'Private upstream diagnostic must not escape' })
      if (state.mode === 'rate-limit') return send(429, {})
      if (state.mode === 'slow') return setTimeout(() => send(200, []), 150)
      if (state.mode === 'malformed') return send(200, { invalid: true })
      if (pathname === '/api/v1/vendors') {
        if (state.mode === 'missing-vendor') return send(503, {})
        return send(200, (criteria.codes || []).map(code => ({ code, name: `${code} Company Ltd` })))
      }
      if (criteria.vendorInvoiceIDs) {
        const rows = (state.invoices || [invoice(), invoice(102, 'OTHER')]).filter(row => criteria.vendorInvoiceIDs.includes(row.id))
        const page = rows.slice(criteria.offset, criteria.offset + criteria.limit)
        return send(200, page.length ? page : null)
      }
      if (state.mode === 'wrong-match') return send(200, [{ ...invoice(), invoiceNumber: 'OTHER-200' }])
      if (criteria.invoiceNumbers?.[0] === 'PAGED') {
        const rows = Array.from({ length: 26 }, (_, i) => ({ ...invoice(200 + i), invoiceNumber: 'PAGED' }))
        return send(200, rows.slice(criteria.offset, criteria.offset + criteria.limit))
      }
      const rows = criteria.invoiceNumbers?.[0] === 'TEST-100' ? [invoice(), invoice(102, 'OTHER')] : []
      const page = rows.slice(criteria.offset, criteria.offset + criteria.limit)
      return send(200, page.length ? page : null)
    })
  }
}

// Vitest imports this handler into its own HTTP server. Postman runs this file.
if (!process.env.VITEST) http.createServer(createHandler()).listen(Number(process.env.PORT || 4502))
module.exports = { createHandler, PUBLIC_KEY, PRIVATE_KEY }
