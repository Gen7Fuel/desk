const express = require('express')
const request = require('supertest')
const http = require('node:http')
const crypto = require('node:crypto')
const { authHeader } = require('../../tests/helpers/auth')
const { createHandler, PUBLIC_KEY, PRIVATE_KEY } = require('../../../postman/mocks/bookworks/default')
const { createClient, createToken } = require('./bookworks.service')
const { createRouter } = require('./bookworks.routes')

let server, state, app
const auth = (read = true) => authHeader({ permissions: { hub: { intacct: { read } } } })
beforeEach(async () => {
  state = { requests: [], mode: 'default' }
  server = http.createServer(createHandler(state))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const client = createClient({ baseUrl: `http://127.0.0.1:${server.address().port}`, publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY, timeoutMs: 60, allowHttp: true })
  app = express().use('/api/bookworks', createRouter(client))
})
afterEach(async () => {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
})
const search = (number = 'TEST-100', offset = '0') => request(app).get('/api/bookworks/invoices').query({ invoiceNumber: number, offset }).set('Authorization', auth())

it('requires authentication and the server-side Intacct read permission before calling Bookworks', async () => {
  expect((await request(app).get('/api/bookworks/invoices?invoiceNumber=TEST-100')).status).toBe(401)
  expect((await request(app).get('/api/bookworks/invoices?invoiceNumber=TEST-100').set('Authorization', auth(false))).status).toBe(403)
  expect(state.requests).toEqual([])
})

it('searches over real HTTP with GET bodies, returns both vendors, names, and GL distributions', async () => {
  const res = await search(' TEST-100 ')
  expect(res.status).toBe(200)
  expect(res.headers['cache-control']).toBe('no-store')
  expect(res.body.invoices).toHaveLength(2)
  expect(res.body.invoices[0]).toMatchObject({ id: 101, invoiceNumber: 'TEST-100', vendorName: 'EXAMPLE Company Ltd', totalAmount: 123.45, distributions: [{ glAccountCode: '12000', amount: 123.45 }] })
  expect(state.requests).toEqual([
    { method: 'GET', pathname: '/api/v1/vendor/invoices', criteria: { invoiceNumbers: ['TEST-100'], limit: 25, offset: 0 } },
    { method: 'GET', pathname: '/api/v1/vendors', criteria: { codes: ['EXAMPLE', 'OTHER'], limit: 50, offset: 0 } },
  ])
  expect(JSON.stringify(res.body)).not.toContain(PRIVATE_KEY)
})

it('normalizes null no-match responses without vendor requests', async () => {
  const res = await search('MISSING')
  expect(res.status).toBe(200)
  expect(res.body).toMatchObject({ invoices: [], hasMore: false })
  expect(state.requests).toHaveLength(1)
})

it('paginates exact matches without duplicating records', async () => {
  const first = await search('PAGED')
  const next = await search('PAGED', '25')
  expect(first.body.invoices).toHaveLength(25)
  expect(first.body.hasMore).toBe(true)
  expect(next.body.invoices).toHaveLength(1)
  expect(next.body.hasMore).toBe(false)
  expect(first.body.invoices.some(row => row.id === next.body.invoices[0].id)).toBe(false)
})

it.each([['', '0'], ['x'.repeat(101), '0'], ['TEST-100', '-1'], ['TEST-100', '1.5'], ['TEST-100', '100001']])('rejects invalid input %s at offset %s before upstream calls', async (number, offset) => {
  expect((await search(number, offset)).status).toBe(400)
  expect(state.requests).toHaveLength(0)
})

it.each([['unauthorized', 502], ['server', 502], ['rate-limit', 503], ['slow', 504], ['malformed', 502], ['wrong-match', 502]])('handles upstream %s safely', async (mode, status) => {
  state.mode = mode
  const res = await search()
  expect(res.status).toBe(status)
  expect(res.body.message).toBeTruthy()
  expect(JSON.stringify(res.body)).not.toContain('Private upstream diagnostic')
  expect(JSON.stringify(res.body)).not.toContain(PRIVATE_KEY)
})

it('preserves invoice details with a warning when vendor lookup is unavailable', async () => {
  state.mode = 'missing-vendor'
  const res = await search()
  expect(res.status).toBe(200)
  expect(res.body.invoices[0]).toMatchObject({ vendorCode: 'EXAMPLE', vendorName: null })
  expect(res.body.warnings).toHaveLength(1)
})

it('derives the documented key/IV and encrypts the UTC timestamp, including short private keys', () => {
  for (const privateKey of [PRIVATE_KEY, 'short']) {
    const key = Buffer.alloc(32)
    Buffer.from(privateKey).copy(key, 0, 0, 32)
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, key.subarray(0, 16))
    const token = createToken(PUBLIC_KEY, privateKey, new Date('2026-11-11T12:34:56Z'))
    expect(Buffer.concat([decipher.update(Buffer.from(token, 'base64')), decipher.final()]).toString('utf8')).toBe(`${PUBLIC_KEY}20261111123456`)
  }
  expect(() => createClient({ baseUrl: 'http://example.test', publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY })).toThrow('not configured')
  expect(() => createClient({ baseUrl: 'https://example.test', publicKey: PUBLIC_KEY })).toThrow('not configured')
})
