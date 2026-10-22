const request = require('supertest')
const express = require('express')
const service = require('./tradogram.service')
const vendorService = require('./tradogram.vendor')
const { SiteAccount, DeliveryDraft } = require('./tradogram.model')
const { authHeader } = require('../../tests/helpers/auth')

const delivery = { DeliveryCode: 'abcdefghijkl', POCode: 'mnopqrstuvwx', SupplierName: 'Supplier', POStatus: 'In Delivery', IsBooked: true, ReceiveDate: '2026-10-20',
  DeliveryItems: [{ DeliveryItemCode: 'line1', LineItemCode: 'po-line', ItemName: 'Pump', QtyOrdered: '100', QtyReceived: '40' }] }
const po = { Currency: 'CAD', SupplierAccountNumber: 'V001', LineItems: [{ LineItemCode: 'po-line', UnitPrice: '12.25' }] }
const config = { site: 'Walpole', sageLocationId: 'G100', loanAccountId: '13001', inventoryAccountId: '14000' }
const input = { site: 'Walpole', vendorId: 'V001', lines: [{ id: 'line1', accountType: 'loan' }] }
const accounts = [
  { code: 'loan-1', name: 'Loan Walpole', number: '13001', type: 'loan' },
  { code: 'loan-2', name: 'Loan Other Site', number: '13002', type: 'loan' },
  { code: 'inventory', name: 'Build Inventory', number: '14000', type: 'inventory' },
]
const auth = (update = true) => authHeader({ permissions: { hub: { intacct: { read: true, update } } } })
const app = () => express().use(express.json()).use('/tradogram', require('./tradogram.routes'))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('delivery accounting preparation', () => {
  it('values only quantities received on a partial delivery and joins prices by PO line code', () => {
    const source = service.normalize(delivery, po)
    expect(source.subtotal).toBe(490)
    expect(source.lines[0]).toMatchObject({ quantity: 40, ordered: 100, unitPrice: 12.25 })
    const preview = service.prepare(source, input, config, accounts)
    expect(preview.issues).toEqual([])
    expect(preview.lines[0].accountId).toBe('13001')
    expect(service.prepare(source, input, { ...config, loanAccountId: '13002' }, accounts).lines[0].accountId).toBe('13002')
  })
  it('requires a price match, booked receipt, configured account, and per-line choice', () => {
    const source = service.normalize({ ...delivery, IsBooked: false }, { ...po, LineItems: [] })
    const preview = service.prepare(source, { ...input, lines: [] }, null)
    expect(preview.issues.join(' ')).toContain('Missing PO price')
    expect(preview.issues.join(' ')).toContain('booked')
    expect(preview.issues.join(' ')).toContain('Loan or Inventory')
    expect(service.prepare(service.normalize(delivery, po), input, { ...config, loanAccountId: '' }, accounts).issues.join(' ')).toContain('Loan or Inventory')
  })
  it('detects quantity or PO pricing changes in the source fingerprint', () => {
    const original = service.normalize(delivery, po)
    expect(service.normalize(delivery, { ...po, LineItems: [{ LineItemCode: 'po-line', UnitPrice: '13' }] }).sourceHash).not.toBe(original.sourceHash)
  })
  it('uses API-key authentication without changing fetch flags', async () => {
    vi.stubEnv('TRADOGRAM_API_KEY', 'test-only-token')
    const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ Deliveries: [delivery] }) })
    vi.stubGlobal('fetch', mock)
    await service.listDeliveries(2)
    expect(mock.mock.calls[0][0].searchParams.get('updateFetchFlag')).toBe('false')
    expect(mock.mock.calls[0][0].searchParams.get('fetchType')).toBe('Both')
    expect(mock.mock.calls[0][1].headers['x-api-key']).toBe(Buffer.from('test-only-token').toString('base64'))
  })
})

describe('Tradogram API authorization and drafts', () => {
  beforeEach(() => { vi.spyOn(service, 'listGLAccounts').mockResolvedValue(accounts) })
  beforeEach(() => { vi.spyOn(vendorService, 'resolveVendor').mockResolvedValue({ vendor: { id: 'V001', key: '1', name: 'Supplier', status: 'active', entityId: 'G100' }, issue: '' }) })
  it('rejects anonymous readers and read-only writers before accessing upstream or Mongo', async () => {
    expect((await request(app()).get('/tradogram/sites')).status).toBe(401)
    expect((await request(app()).put('/tradogram/sites').set('Authorization', auth(false)).send(config)).status).toBe(403)
    expect((await request(app()).put('/tradogram/deliveries/abcdefghijkl/draft').set('Authorization', auth(false)).send({})).status).toBe(403)
  })
  it('rejects a stale review before saving', async () => {
    vi.spyOn(service, 'loadDelivery').mockResolvedValue(service.normalize(delivery, po))
    const res = await request(app()).put('/tradogram/deliveries/abcdefghijkl/draft').set('Authorization', auth()).send({ ...input, status: 'ready', sourceHash: 'old' })
    expect(res.status).toBe(409)
  })
  it('does not mark an incomplete receipt ready', async () => {
    const source = service.normalize(delivery, po)
    vi.spyOn(service, 'loadDelivery').mockResolvedValue(source)
    vi.spyOn(SiteAccount, 'findOne').mockReturnValue({ lean: async () => null })
    const res = await request(app()).put('/tradogram/deliveries/abcdefghijkl/draft').set('Authorization', auth()).send({ ...input, status: 'ready', sourceHash: source.sourceHash })
    expect(res.status).toBe(422)
  })
  it('saves a separate delivery draft with server-derived values and ignores a forged Intacct key', async () => {
    const source = service.normalize(delivery, po)
    vi.spyOn(service, 'loadDelivery').mockResolvedValue(source)
    vi.spyOn(SiteAccount, 'findOne').mockReturnValue({ lean: async () => config })
    const create = vi.spyOn(DeliveryDraft, 'create').mockImplementation(async (value) => value)
    const res = await request(app()).put('/tradogram/deliveries/abcdefghijkl/draft').set('Authorization', auth()).send({ ...input, status: 'ready', sourceHash: source.sourceHash, intacctBillKey: 'forged', subtotal: 1 })
    expect(res.status).toBe(200)
    expect(create.mock.calls[0][0]).not.toHaveProperty('intacctBillKey')
    expect(res.body.draft.snapshot.subtotal).toBe(490)
    expect(res.body.draft.deliveryCode).toBe(delivery.DeliveryCode)
  })
  it('returns a conflict instead of overwriting another user’s revision', async () => {
    const source = service.normalize(delivery, po)
    vi.spyOn(service, 'loadDelivery').mockResolvedValue(source)
    vi.spyOn(SiteAccount, 'findOne').mockReturnValue({ lean: async () => config })
    vi.spyOn(DeliveryDraft, 'findOneAndUpdate').mockResolvedValue(null)
    const res = await request(app()).put('/tradogram/deliveries/abcdefghijkl/draft').set('Authorization', auth()).send({ ...input, revision: 1, status: 'ready', sourceHash: source.sourceHash })
    expect(res.status).toBe(409)
  })
})
