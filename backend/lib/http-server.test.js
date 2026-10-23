const http = require('node:http')
const express = require('express')
const jwt = require('jsonwebtoken')
const { createApiServer } = require('./http-server')
const { authenticate, requirePermission } = require('../middleware/auth')

async function withServer(fn) {
  const app = express()
  const handler = vi.fn((_req, res) => res.json({ ok: true }))
  app.get('/api/tradogram/settings', authenticate, requirePermission('hub.intacct', 'read'), handler)
  const server = createApiServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try { await fn(server.address().port, handler) } finally { await new Promise((resolve) => server.close(resolve)) }
}
function send(port, authorization) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/tradogram/settings', agent: false, headers: { Authorization: authorization } }, (res) => {
      res.resume(); res.on('end', () => resolve(res.statusCode))
    })
    req.on('error', reject)
  })
}
it('accepts a large valid Desk token and still enforces permissions', async () => {
  const payload = { externalToken: 'x'.repeat(30000), permissions: { hub: { intacct: { read: true } } } }
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'desk-dev-secret')
  expect(Buffer.byteLength(token)).toBeGreaterThan(32768)
  await withServer(async (port, handler) => {
    expect(await send(port, 'Bearer ' + token)).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
    const denied = jwt.sign({ ...payload, permissions: {} }, process.env.JWT_SECRET || 'desk-dev-secret')
    expect(await send(port, 'Bearer ' + denied)).toBe(403)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
it('rejects invalid authentication within the larger header budget', async () => {
  await withServer(async (port, handler) => {
    expect(await send(port, 'Bearer ' + 'x'.repeat(40000))).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })
})
it('keeps a bounded limit and rejects oversized headers before the route runs', async () => {
  await withServer(async (port, handler) => {
    expect(await send(port, 'Bearer ' + 'x'.repeat(70000))).toBe(431)
    expect(handler).not.toHaveBeenCalled()
  })
})
