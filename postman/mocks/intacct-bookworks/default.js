const http = require('node:http')

function createHandler(state = {}) {
  state.bills ||= []
  return (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
    if (req.method !== 'POST' || !['/oauth2/token', '/services/core/query', '/objects/accounts-payable/bill'].includes(path)) return send(501, {})
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      if (path === '/oauth2/token') return send(200, { access_token: 'synthetic-sage-token' })
      if (req.headers.authorization !== 'Bearer synthetic-sage-token' || req.headers['x-ia-api-param-entity'] !== 'A210') return send(403, {})
      let body
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return send(400, {}) }
      state.requests?.push({ path, body, entity: req.headers['x-ia-api-param-entity'] })
      if (path === '/services/core/query') {
        if (body.object === 'accounts-payable/vendor') {
          const id = body.filters.find(filter => filter.$eq?.id)?.$eq.id
          const rows = id && id !== 'V001' ? [] : [{ key: '11', id: 'V001', name: 'Example Company Ltd', status: state.mode === 'inactive' ? 'inactive' : 'active' }]
          return send(200, { 'ia::result': rows, 'ia::meta': { totalCount: rows.length } })
        }
        if (body.object === 'accounts-payable/bill') {
          const number = body.filters.find(filter => filter.$eq?.billNumber)?.$eq.billNumber
          const rows = state.bills.filter(bill => bill.billNumber === number)
          return send(200, { 'ia::result': rows, 'ia::meta': { totalCount: rows.length } })
        }
        return send(501, {})
      }
      if (state.mode === 'reject') return send(400, { message: 'Private validation diagnostic' })
      state.bills.push({ key: '9001', billNumber: body.billNumber, state: body.state })
      if (state.mode === 'timeout') return setTimeout(() => send(201, { 'ia::result': { key: '9001' } }), 250)
      return send(201, { 'ia::result': { key: '9001' } })
    })
  }
}
if (!process.env.VITEST) http.createServer(createHandler()).listen(Number(process.env.PORT || 4503))
module.exports = { createHandler }
