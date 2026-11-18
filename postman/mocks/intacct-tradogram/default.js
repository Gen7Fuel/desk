const http = require('node:http')
function createHandler(state = {}) {
  state.bills ||= []
  state.requests ||= []
  return (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    }
    if (
      req.method !== 'POST' ||
      ![
        '/oauth2/token',
        '/services/core/query',
        '/objects/accounts-payable/bill',
      ].includes(path)
    )
      return send(501, {})
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      if (path === '/oauth2/token')
        return send(200, { access_token: 'synthetic-tradogram-sage-token' })
      if (
        req.headers.authorization !== 'Bearer synthetic-tradogram-sage-token' ||
        req.headers['x-ia-api-param-entity'] !== (state.entityId || 'A210')
      )
        return send(403, {})
      let body
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        return send(400, {})
      }
      state.requests.push({
        path,
        body,
        entityId: req.headers['x-ia-api-param-entity'],
      })
      if (path === '/services/core/query') {
        if (state.mode === 'lookup-error') return send(500, {})
        const number = body.filters.find((filter) => filter.$eq?.billNumber)
          ?.$eq.billNumber
        const vendor = body.filters.find((filter) => filter.$eq?.['vendor.id'])
          ?.$eq['vendor.id']
        const rows = state.bills.filter(
          (bill) =>
            bill.billNumber.toLowerCase() === number.toLowerCase() &&
            bill.vendor.id === vendor,
        )
        return send(200, {
          'ia::result': rows,
          'ia::meta': { totalCount: rows.length },
        })
      }
      if (state.mode === 'reject')
        return send(422, { message: 'Synthetic private validation detail' })
      if (body.state !== 'draft') return send(422, {})
      const bill = { key: String(9001 + state.bills.length), ...body }
      state.bills.push(bill)
      if (state.mode === 'timeout')
        return setTimeout(
          () => send(201, { 'ia::result': { key: bill.key } }),
          300,
        )
      if (state.mode === 'invalid-result') return send(201, {})
      return send(201, { 'ia::result': { key: bill.key, state: 'draft' } })
    })
  }
}
if (!process.env.VITEST)
  http.createServer(createHandler()).listen(Number(process.env.PORT || 4504))
module.exports = { createHandler }
