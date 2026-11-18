const http = require('node:http')
const express = require('express')
const request = require('supertest')
const { authHeader } = require('../../tests/helpers/auth')
const { createClient, loadInvoice } = require('./bookworks.service')
const { createSageClient } = require('./bookworks.sage')
const { createIntegration, buildPreview, buildBill } = require('./bookworks.drafts')
const { createRouter } = require('./bookworks.routes')
const bwMock = require('../../../postman/mocks/bookworks/default')
const sageMock = require('../../../postman/mocks/intacct-bookworks/default')

const invoice = () => ({
  id: 501, invoiceNumber: 'TEST-AP-501', vendorCode: 'EXAMPLE', posted: true,
  invoiceDate: '2026-10-20T00:00:00', dueDate: '2026-10-28T00:00:00', totalAmount: 82403.89,
  distributions: [
    { glAccountCode: '22000', debitOrCredit: 'D', amount: 9480.09 },
    { glAccountCode: '29999', debitOrCredit: 'D', amount: 72923.80 },
  ],
})
let bw, sage, bwState, sageState, client, api, integration, repository, mapping, entry, app
const auth = update => authHeader({ email: 'reviewer@example.test', permissions: { hub: { intacct: { read: true, update } } } })
const call = (method, path, body, update = true) => request(app)[method]('/api/bookworks' + path).set('Authorization', auth(update)).send(body)
const preview = (cogsType = 'fuel') => call('post', '/invoices/501/draft-preview', { cogsType })
const create = hash => call('post', '/invoices/501/intacct-draft', { cogsType: 'fuel', previewHash: hash, state: 'posted', entityId: 'OTHER', totalAmount: 1 })

beforeEach(async () => {
  bwState = { invoices: [invoice()], requests: [] }; sageState = { requests: [], bills: [] }
  bw = http.createServer(bwMock.createHandler(bwState)); sage = http.createServer(sageMock.createHandler(sageState))
  await Promise.all([bw, sage].map(server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))))
  client = createClient({ baseUrl: `http://127.0.0.1:${bw.address().port}`, publicKey: bwMock.PUBLIC_KEY, privateKey: bwMock.PRIVATE_KEY, allowHttp: true })
  api = createSageClient({ baseUrl: `http://127.0.0.1:${sage.address().port}/`, clientId: 'synthetic-client', clientSecret: 'synthetic-secret', allowHttp: true, timeoutMs: 80 })
  mapping = { vendorId: 'V001', vendorName: 'Example Company Ltd' }; entry = null
  repository = {
    getMapping: vi.fn(async () => mapping),
    saveMapping: vi.fn(async (_filter, data) => { mapping = data }),
    getEntry: vi.fn(async () => entry),
    claimEntry: vi.fn(async (_filter, data) => {
      if (entry && entry.status !== 'failed') return { claimed: false, entry }
      entry = { ...data, status: 'creating' }; return { claimed: true, entry }
    }),
    updateEntry: vi.fn(async (_filter, data) => { entry = { ...entry, ...data } }),
  }
  integration = createIntegration({ client, sage: api, repository, sourceKey: 'synthetic-bookworks' })
  app = express().use(express.json()).use('/api/bookworks', createRouter(client, integration))
})
afterEach(async () => {
  for (const server of [bw, sage]) server.closeAllConnections()
  await Promise.all([bw, sage].map(server => new Promise(resolve => server.close(resolve))))
})

it('creates only a draft in A210 with correct CAD debits and automatic AP credit', async () => {
  const p = await preview()
  expect(p.status).toBe(200)
  expect(p.body).toMatchObject({ costCents: 7292380, hstCents: 948009, totalCents: 8240389, cogsAccount: '50200', currency: 'CAD', postingDate: '2026-10-20', dueDate: '2026-10-28' })
  const result = await create(p.body.hash)
  expect(result.status).toBe(200)
  expect(result.body).toMatchObject({ billKey: '9001', entityId: 'A210', state: 'draft' })
  const sent = sageState.requests.find(r => r.path === '/objects/accounts-payable/bill')
  expect(sent.entity).toBe('A210')
  expect(sent.body.state).toBe('draft')
  expect(sent.body.lines.map(line => [line.glAccount.id, line.txnAmount])).toEqual([['50200', '72923.80'], ['22000', '9480.09']])
  expect(sent.body.currency).toEqual({ baseCurrency: 'CAD', txnCurrency: 'CAD' })
  expect(sent.body.lines.every(line => line.dimensions.location.id === 'A210' && line.taxEntries[0].txnTaxAmount === '0')).toBe(true)
  expect(entry.status).toBe('created')
})

it('supports Freight and a zero-HST invoice without inventing tax', async () => {
  const source = invoice(); source.distributions = [{ glAccountCode: '29999', debitOrCredit: 'D', amount: source.totalAmount }]
  const p = buildPreview(source, { id: 'V001' }, 'freight')
  expect(buildBill(p).lines.map(line => line.glAccount.id)).toEqual(['51050'])
  expect(p.hstCents).toBe(0)
})

it('enforces update permission for mapping, preview, and draft creation', async () => {
  for (const [method, path, body] of [
    ['put', '/invoices/501/vendor-mapping', { vendorId: 'V001' }],
    ['post', '/invoices/501/draft-preview', { cogsType: 'fuel' }],
    ['post', '/invoices/501/intacct-draft', {}],
  ]) expect((await call(method, path, body, false)).status).toBe(403)
  expect(bwState.requests).toHaveLength(0)
  expect(sageState.requests).toHaveLength(0)
})

it('saves only a verified vendor mapping scoped to source and A210', async () => {
  expect((await call('put', '/invoices/501/vendor-mapping', { vendorId: 'INVALID' })).status).toBe(400)
  expect(repository.saveMapping).not.toHaveBeenCalled()
  expect((await call('put', '/invoices/501/vendor-mapping', { vendorId: 'V001' })).status).toBe(200)
  expect(repository.saveMapping).toHaveBeenCalledWith({ sourceKey: 'synthetic-bookworks', entityId: 'A210', vendorCode: 'EXAMPLE' }, expect.objectContaining({ vendorId: 'V001', updatedBy: 'reviewer@example.test' }))
})

it('rejects unposted invoices, missing mappings, and inactive Intacct vendors', async () => {
  bwState.invoices[0].posted = false
  expect((await preview()).status).toBe(400)
  expect(sageState.requests).toHaveLength(0)
  bwState.invoices[0].posted = true; mapping = null
  expect((await preview()).status).toBe(400)
  mapping = { vendorId: 'V001' }; sageState.mode = 'inactive'
  expect((await preview()).status).toBe(400)
})

it('rejects changed source data and prevents stale preview submission', async () => {
  const p = await preview()
  bwState.invoices[0].dueDate = '2026-10-29T00:00:00'
  expect((await create(p.body.hash)).status).toBe(409)
  expect(repository.claimEntry).not.toHaveBeenCalled()
  expect(sageState.bills).toHaveLength(0)
})

it('rejects missing previews, bad IDs, invalid COGS, and unbalanced distributions', async () => {
  expect((await create('invalid')).status).toBe(400)
  expect((await call('post', '/invoices/nope/draft-preview', { cogsType: 'fuel' })).status).toBe(400)
  expect((await preview('other')).status).toBe(400)
  bwState.invoices[0].distributions[1].amount = 1
  expect((await preview()).status).toBe(400)
  expect(sageState.bills).toHaveLength(0)
})

it('does not create a second bill on repeated submission', async () => {
  const p = await preview()
  expect((await create(p.body.hash)).status).toBe(200)
  const second = await create(p.body.hash)
  expect(second.body.alreadyCreated).toBe(true)
  expect(sageState.bills).toHaveLength(1)
})

it('rejects a bill number already present in Intacct before any write', async () => {
  sageState.bills.push({ key: 'old', billNumber: 'TEST-AP-501', state: 'posted' })
  const p = await preview()
  expect((await create(p.body.hash)).status).toBe(409)
  expect(sageState.requests.filter(r => r.path === '/objects/accounts-payable/bill')).toHaveLength(0)
})

it('marks a timed-out creation uncertain and blocks another POST, including concurrent submissions', async () => {
  sageState.mode = 'timeout'
  const p = await preview()
  const results = await Promise.all([create(p.body.hash), create(p.body.hash)])
  expect(results.map(res => res.status).sort()).toEqual([409, 502])
  expect(entry.status).toBe('uncertain')
  expect(sageState.bills).toHaveLength(1)
  expect((await create(p.body.hash)).status).toBe(409)
  expect(sageState.bills).toHaveLength(1)
})

it('allows retry after an explicit validation rejection without exposing upstream diagnostics', async () => {
  sageState.mode = 'reject'
  const p = await preview()
  const result = await create(p.body.hash)
  expect(result.status).toBe(502)
  expect(JSON.stringify(result.body)).not.toContain('Private validation diagnostic')
  expect(entry.status).toBe('failed')
  sageState.mode = 'default'
  expect((await create(p.body.hash)).status).toBe(200)
})

it('retains the reference when Intacct succeeds but saving the local result fails', async () => {
  const update = repository.updateEntry.getMockImplementation()
  repository.updateEntry.mockImplementation(async (filter, data) => {
    if (data.status === 'created') throw new Error('Database unavailable')
    return update(filter, data)
  })
  const p = await preview()
  const result = await create(p.body.hash)
  expect(result.status).toBe(502)
  expect(result.body.message).toContain('9001')
  expect(entry).toMatchObject({ status: 'uncertain', billKey: '9001' })
})

it('normalizes invoice ID lookups and handles missing IDs', async () => {
  expect((await loadInvoice(501, client)).invoiceNumber).toBe('TEST-AP-501')
  await expect(loadInvoice(999, client)).rejects.toMatchObject({ status: 404 })
})
