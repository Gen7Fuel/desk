const http = require('node:http')
const express = require('express')
const request = require('supertest')
const { authHeader } = require('../../tests/helpers/auth')
const service = require('./tradogram.service')
const { createIntegration } = require('./tradogram.drafts')
const { createSageClient } = require('./tradogram.sage')
const { createRouter } = require('./tradogram.routes')
const { DeliveryDraft } = require('./tradogram.model')
const mock = require('../../../postman/mocks/intacct-tradogram/default')
const code = 'abcdefghijkl'
const accounts = [
  { code: 'loan', name: 'Construction Loan', number: '13001', type: 'loan' },
]
const config = {
  site: 'Construction',
  loanAccountId: '13001',
  inventoryAccountId: '',
}
const fields = {
  billNumber: 'INV-100-abcdefghijkl',
  invoiceDate: '2026-11-01',
  dueDate: '2026-11-30',
}
let source, draft, repo, sourceApi, vendorLookup, state, server, app
const auth = (update) =>
  authHeader({
    email: 'reviewer@example.test',
    permissions: { hub: { intacct: { read: true, update } } },
  })
const call = (path, data, update = true) =>
  request(app)
    .post(`/api/tradogram/deliveries/${code}/${path}`)
    .set('Authorization', auth(update))
    .send(data)
const preview = (extra = {}) => call('draft-preview', { ...fields, ...extra })
const create = (hash, extra = {}) =>
  call('intacct-draft', {
    ...fields,
    previewHash: hash,
    subtotalAcknowledged: true,
    state: 'posted',
    entityId: 'OTHER',
    totalCents: 1,
    ...extra,
  })

beforeEach(async () => {
  vi.stubEnv('TRADOGRAM_SAGE_ENTITY_ID', 'A210')
  source = service.normalize(
    {
      DeliveryCode: code,
      POCode: 'mnopqrstuvwx',
      POStatus: 'In Delivery',
      IsBooked: true,
      ReceiveDate: '2026-11-01',
      DeliveryItems: [
        {
          DeliveryItemCode: 'line1',
          LineItemCode: 'po1',
          ItemName: 'Pump',
          QtyOrdered: 100,
          QtyReceived: 4,
        },
      ],
    },
    {
      Currency: 'CAD',
      SupplierAccountNumber: 'V001',
      LineItems: [{ LineItemCode: 'po1', UnitPrice: 25 }],
    },
  )
  draft = {
    deliveryCode: code,
    revision: 1,
    status: 'ready',
    site: config.site,
    sourceHash: source.sourceHash,
    lines: [{ id: 'line1', glAccountCode: 'loan' }],
    intacctBillKey: '',
    intacctCreationState: '',
  }
  draft.configHash = service.prepare(source, draft, config, accounts).configHash
  sourceApi = {
    loadDelivery: vi.fn(async () => source),
    listGLAccounts: vi.fn(async () => accounts),
    prepare: service.prepare,
  }
  vendorLookup = vi.fn(async () => ({
    vendor: {
      id: 'V001',
      key: '1',
      name: 'Example Vendor',
      status: 'active',
      entityId: 'A210',
    },
    issue: '',
  }))
  repo = {
    getDraft: vi.fn(async () => structuredClone(draft)),
    getSite: vi.fn(async () => config),
    claim: vi.fn(async (_code, p) => {
      if (
        draft.revision !== p.revision ||
        ['creating', 'created', 'uncertain'].includes(
          draft.intacctCreationState,
        )
      )
        return null
      Object.assign(draft, {
        intacctCreationState: 'creating',
        intacctEntityId: p.entityId,
        intacctBillNumber: p.billNumber,
      })
      return structuredClone(draft)
    }),
    finish: vi.fn(async (_code, _hash, values) => {
      Object.assign(draft, values)
    }),
  }
  state = { requests: [], bills: [] }
  server = http.createServer(mock.createHandler(state))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const integration = createIntegration({
    repo,
    sourceApi,
    vendorLookup,
    sageFactory: (entityId) =>
      createSageClient({
        entityId,
        baseUrl: `http://127.0.0.1:${server.address().port}/`,
        clientId: 'synthetic-client',
        clientSecret: 'synthetic-secret',
        timeoutMs: 150,
        allowHttp: true,
      }),
  })
  app = express()
    .use(express.json())
    .use('/api/tradogram', createRouter(integration))
})
afterEach(async () => {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it('creates one A210 draft for received quantities, using server accounts and amounts despite forged inputs', async () => {
  const p = await preview()
  expect(p.status).toBe(200)
  expect(p.headers['cache-control']).toBe('no-store')
  expect(p.body).toMatchObject({
    entityId: 'A210',
    currency: 'CAD',
    totalCents: 10000,
    subtotalOnly: true,
  })
  const result = await create(p.body.hash)
  expect(result.status).toBe(200)
  expect(result.body).toMatchObject({
    billKey: '9001',
    entityId: 'A210',
    state: 'draft',
  })
  expect(state.bills).toHaveLength(1)
  expect(state.bills[0]).toMatchObject({
    state: 'draft',
    billNumber: fields.billNumber,
    createdDate: fields.invoiceDate,
    postingDate: fields.invoiceDate,
    dueDate: fields.dueDate,
    vendor: { id: 'V001' },
    currency: { baseCurrency: 'CAD', txnCurrency: 'CAD' },
  })
  expect(state.bills[0].lines).toHaveLength(1)
  expect(state.bills[0].lines[0]).toMatchObject({
    glAccount: { id: '13001' },
    txnAmount: '100.00',
    dimensions: { location: { id: 'A210' } },
  })
  expect(state.bills[0]).not.toHaveProperty('taxSolution')
  expect(draft.intacctCreationState).toBe('created')
  expect(repo.claim).toHaveBeenCalledWith(
    code,
    expect.any(Object),
    'reviewer@example.test',
  )
})

it('enforces authentication and update permission before reading source or Mongo', async () => {
  for (const path of ['draft-preview', 'intacct-draft']) {
    expect(
      (
        await request(app)
          .post(`/api/tradogram/deliveries/${code}/${path}`)
          .send(fields)
      ).status,
    ).toBe(401)
    expect((await call(path, fields, false)).status).toBe(403)
  }
  expect(repo.getDraft).not.toHaveBeenCalled()
  expect(sourceApi.loadDelivery).not.toHaveBeenCalled()
})

it('requires ready status, a current saved review and an active company-scoped vendor', async () => {
  draft.status = 'draft'
  expect((await preview()).status).toBe(409)
  draft.status = 'ready'
  draft.sourceHash = 'old'
  expect((await preview()).status).toBe(409)
  draft.sourceHash = source.sourceHash
  draft.configHash = 'old'
  expect((await preview()).status).toBe(409)
  draft.configHash = service.prepare(source, draft, config, accounts).configHash
  vendorLookup.mockResolvedValue({ vendor: null, issue: 'Vendor is inactive.' })
  expect((await preview()).status).toBe(422)
  expect(state.requests).toHaveLength(0)
})

it('rejects changed bill fields, source data, vendor or company after preview without sending', async () => {
  const p = await preview()
  expect((await create(p.body.hash, { dueDate: '2026-12-01' })).status).toBe(
    409,
  )
  vendorLookup.mockResolvedValue({
    vendor: { id: 'V002', key: '2', entityId: 'A210' },
    issue: '',
  })
  expect((await create(p.body.hash)).status).toBe(409)
  vi.stubEnv('TRADOGRAM_SAGE_ENTITY_ID', 'T010')
  expect((await create(p.body.hash)).status).toBe(409)
  expect(state.bills).toHaveLength(0)
})

it('requires explicit subtotal acknowledgment, preview, valid dates and a bill number', async () => {
  const p = await preview()
  expect(
    (await create(p.body.hash, { subtotalAcknowledged: false })).status,
  ).toBe(400)
  expect((await create('bad')).status).toBe(400)
  for (const extra of [
    { billNumber: '' },
    { invoiceDate: '2026-02-30' },
    { dueDate: '2026-10-01' },
  ])
    expect((await preview(extra)).status).toBe(400)
  expect(state.bills).toHaveLength(0)
})

it('rejects unsupported currency and inconsistent amounts', async () => {
  source.currency = 'USD'
  expect((await preview()).status).toBe(422)
  source.currency = 'CAD'
  source.subtotal = 200
  expect((await preview()).status).toBe(422)
  source.subtotal = 100
  source.lines[0].amount = NaN
  expect((await preview()).status).toBe(422)
})

it('returns the saved reference on replay and creates once on concurrent submission', async () => {
  const p = await preview()
  const results = await Promise.all([create(p.body.hash), create(p.body.hash)])
  expect(results.map((r) => r.status).sort()).toEqual([200, 409])
  const replay = await create(p.body.hash)
  expect(replay.body).toMatchObject({ alreadyCreated: true, billKey: '9001' })
  expect(state.bills).toHaveLength(1)
})

it('checks Intacct for an existing vendor/bill number before writing', async () => {
  state.bills.push({
    key: 'old',
    vendor: { id: 'V001' },
    billNumber: fields.billNumber,
    state: 'posted',
  })
  const p = await preview()
  expect((await create(p.body.hash)).status).toBe(409)
  expect(state.bills).toHaveLength(1)
  expect(draft.intacctCreationState).toBe('failed')
})

it('allows retry after explicit validation rejection but never retries automatically', async () => {
  state.mode = 'reject'
  const p = await preview()
  const failure = await create(p.body.hash)
  expect(failure.status).toBe(502)
  expect(failure.body.message).not.toContain('private')
  expect(draft.intacctCreationState).toBe('failed')
  expect(
    state.requests.filter((r) => r.path === '/objects/accounts-payable/bill'),
  ).toHaveLength(1)
  state.mode = ''
  expect((await create((await preview()).body.hash)).status).toBe(200)
})

it('blocks retries after a timeout even when the upstream bill was created', async () => {
  state.mode = 'timeout'
  const p = await preview()
  expect((await create(p.body.hash)).status).toBe(502)
  expect(draft.intacctCreationState).toBe('uncertain')
  expect((await create(p.body.hash)).status).toBe(409)
  expect(state.bills).toHaveLength(1)
})

it('blocks ambiguous successful responses without a key and persistence failures after creation', async () => {
  state.mode = 'invalid-result'
  const p = await preview()
  expect((await create(p.body.hash)).status).toBe(502)
  expect(draft.intacctCreationState).toBe('uncertain')
  expect(state.bills).toHaveLength(1)
})

it('reports a returned key if Desk cannot save the successful result', async () => {
  repo.finish.mockRejectedValue(new Error('Synthetic persistence failure'))
  const p = await preview()
  const result = await create(p.body.hash)
  expect(result.status).toBe(502)
  expect(result.body.message).toContain('9001')
  expect(draft.intacctCreationState).toBe('creating')
  expect((await create(p.body.hash)).status).toBe(409)
  expect(state.bills).toHaveLength(1)
})

it('does not overwrite a saved review that changed during the create request', async () => {
  repo.claim.mockImplementation(async () => null)
  const p = await preview()
  expect((await create(p.body.hash)).status).toBe(409)
  expect(state.requests).toHaveLength(0)
})

it('protects the Mongo reservation against competing numbers and editing locked deliveries', async () => {
  const db = createIntegration({ sourceApi, vendorLookup })
  vi.spyOn(DeliveryDraft, 'findOne').mockReturnValue({
    lean: async () => draft,
  })
  const { SiteAccount } = require('./tradogram.model')
  vi.spyOn(SiteAccount, 'findOne').mockReturnValue({ lean: async () => config })
  vi.spyOn(DeliveryDraft, 'init').mockResolvedValue(DeliveryDraft)
  const update = vi.spyOn(DeliveryDraft, 'findOneAndUpdate').mockReturnValue({
    lean: async () => {
      throw Object.assign(new Error('duplicate'), { code: 11000 })
    },
  })
  await expect(
    db.createDraft(
      code,
      {
        ...fields,
        previewHash: (await db.preview(code, fields)).hash,
        subtotalAcknowledged: true,
      },
      'user',
    ),
  ).rejects.toMatchObject({ status: 409 })
  expect(update.mock.calls[0][0]).toMatchObject({
    revision: 1,
    status: 'ready',
    intacctBillKey: '',
    intacctCreationState: { $nin: ['creating', 'created', 'uncertain'] },
  })
  expect(update.mock.calls[0][1].$set.intacctBillNumberKey).toBe(
    fields.billNumber.toLowerCase(),
  )
  const index = DeliveryDraft.schema
    .indexes()
    .find(([keys]) => keys.intacctBillNumberKey)
  expect(index[1].unique).toBe(true)
})

it.skipIf(!process.env.TRADOGRAM_SIM_URL)(
  'exercises the real Intacct HTTP client against the Postman simulation',
  async () => {
    const api = createSageClient({
      entityId: 'A210',
      baseUrl: process.env.TRADOGRAM_SIM_URL,
      clientId: 'fixture',
      clientSecret: 'fixture',
      allowHttp: true,
    })
    const integration = createIntegration({
      repo,
      sourceApi,
      vendorLookup,
      sageFactory: () => api,
    })
    const number = `SIM-${Date.now()}`
    const p = await integration.preview(code, { ...fields, billNumber: number })
    const result = await integration.createDraft(
      code,
      {
        ...fields,
        billNumber: number,
        previewHash: p.hash,
        subtotalAcknowledged: true,
      },
      'simulation',
    )
    expect(result.state).toBe('draft')
    expect(draft.intacctCreationState).toBe('created')
    expect((await api.findBill('V001', number)).state).toBe('draft')
  },
)
