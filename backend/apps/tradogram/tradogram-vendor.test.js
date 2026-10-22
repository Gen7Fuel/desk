const request = require('supertest')
const express = require('express')
const service = require('./tradogram.service')
const vendorService = require('./tradogram.vendor')
const { SiteAccount, DeliveryDraft } = require('./tradogram.model')
const { authHeader } = require('../../tests/helpers/auth')
const auth = authHeader({ permissions: { hub: { intacct: { read: true, update: true } } } })
const app = () => express().use(express.json()).use('/tradogram', require('./tradogram.routes'))
const source = { sourceHash: 'current', supplierAccountNumber: 'V001', issues: [], subtotal: 5, lines: [{ id: 'line', name: 'Pump' }] }
const config = { site: 'Walpole', sageLocationId: 'T010' }
const vendor = { id: 'V001', key: '55', name: 'Intacct Supplier', status: 'active', entityId: 'T010' }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

function mockSage(result, meta = {}) {
  vi.stubEnv('SAGE_CLIENT_ID', 'test-client')
  vi.stubEnv('SAGE_CLIENT_SECRET', 'test-secret')
  const mock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'test-token' }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ 'ia::result': result, 'ia::meta': meta }) })
  vi.stubGlobal('fetch', mock)
  return mock
}

describe('Intacct vendor reference', () => {
  it('matches the supplier account against vendor.id in the explicitly configured entity', async () => {
    const mock = mockSage([{ id: 'V001', key: '55', name: 'Intacct Supplier', status: 'active' }])
    const result = await vendorService.resolveVendor(source, config)
    expect(result).toEqual({ vendor, issue: '' })
    const options = mock.mock.calls[1][1]
    expect(options.headers['X-IA-API-Param-Entity']).toBe('T010')
    expect(JSON.parse(options.body)).toMatchObject({ object: 'accounts-payable/vendor', filters: [{ $eq: { id: 'V001' } }], size: 2 })
  })
  it('does not query production or fall back to a name when the site or account is missing', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect((await vendorService.resolveVendor(source, null)).issue).toContain('Choose a receiving site')
    expect((await vendorService.resolveVendor({ ...source, supplierAccountNumber: '' }, config)).issue).toContain('supplier account number')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('reports an unmatched or inactive vendor rather than accepting it', async () => {
    mockSage([])
    expect((await vendorService.resolveVendor(source, config)).issue).toContain('No Intacct vendor')
    mockSage([{ id: 'V001', key: '55', name: 'Old Supplier', status: 'inactive' }])
    const inactive = await vendorService.resolveVendor(source, config)
    expect(inactive.vendor.status).toBe('inactive')
    expect(inactive.issue).toContain('not active')
  })
  it('rejects ambiguous results and never leaks an authentication response body', async () => {
    mockSage([{ id: 'V001', key: '55' }], { totalCount: 2 })
    expect((await vendorService.resolveVendor(source, config)).issue).toContain('not unique')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ sensitive: 'not-for-user' }) }))
    const failed = await vendorService.resolveVendor(source, config)
    expect(failed.issue).toContain('authenticate')
    expect(JSON.stringify(failed)).not.toContain('not-for-user')
  })
  it('uses the current Tradogram supplier account instead of a stale PO value', () => {
    const delivery = { SupplierAccount: 'OLD', DeliveryItems: [], POStatus: 'In Delivery' }
    const po = { SupplierAccountNumber: 'OLD', Currency: 'CAD', LineItems: [] }
    expect(service.normalize(delivery, po, { SupplierCode: 'supplier1234', AccountNumber: 'V001' }).supplierAccountNumber).toBe('V001')
    expect(service.normalize(delivery, po, { SupplierCode: 'supplier1234', AccountNumber: '' }).supplierAccountNumber).toBe('')
    expect(service.normalize(delivery, po, { SupplierCode: 'supplier1234', AccountNumber: 'V002' }).sourceHash)
      .not.toBe(service.normalize(delivery, po, { SupplierCode: 'supplier1234', AccountNumber: 'V001' }).sourceHash)
  })
  it('reads the supplier master by the PO supplier code', async () => {
    vi.stubEnv('TRADOGRAM_API_KEY', 'test-token')
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ Deliveries: [{ DeliveryCode: 'abcdefghijkl', POCode: 'mnopqrstuvwx', DeliveryItems: [] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ PurchaseOrders: [{ POCode: 'mnopqrstuvwx', SupplierCode: 'supplier1234', SupplierAccountNumber: 'OLD', LineItems: [] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ Suppliers: [{ SupplierCode: 'supplier1234', AccountNumber: 'V001' }] }) })
    vi.stubGlobal('fetch', fetch)
    expect((await service.loadDelivery('abcdefghijkl')).supplierAccountNumber).toBe('V001')
    expect(fetch.mock.calls[2][0].pathname).toBe('/v1.0.4/suppliers/supplier1234')
  })
})

describe('vendor reference routes', () => {
  beforeEach(() => {
    vi.spyOn(service, 'loadDelivery').mockResolvedValue(source)
    vi.spyOn(service, 'listGLAccounts').mockResolvedValue([{ code: 'stock', name: 'Build Inventory', number: '10760', type: 'inventory' }])
    vi.spyOn(SiteAccount, 'findOne').mockReturnValue({ lean: async () => config })
  })
  it('returns the resolved reference and source fingerprint for the selected site', async () => {
    const resolve = vi.spyOn(vendorService, 'resolveVendor').mockResolvedValue({ vendor, issue: '' })
    const result = await request(app()).get('/tradogram/deliveries/abcdefghijkl/vendor?site=Walpole').set('Authorization', auth)
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ vendor, sourceHash: 'current' })
    expect(resolve).toHaveBeenCalledWith(source, config)
    expect((await request(app()).get('/tradogram/deliveries/abcdefghijkl/vendor?site=Walpole')).status).toBe(401)
  })
  it('ignores a manually supplied vendor ID and stores the server-derived reference', async () => {
    vi.spyOn(vendorService, 'resolveVendor').mockResolvedValue({ vendor, issue: '' })
    vi.spyOn(DeliveryDraft, 'create').mockImplementation(async (value) => value)
    const result = await request(app()).put('/tradogram/deliveries/abcdefghijkl/draft').set('Authorization', auth).send({ site: 'Walpole', vendorId: 'FORGED', status: 'ready', sourceHash: 'current', lines: [{ id: 'line', glAccountCode: 'stock' }] })
    expect(result.status).toBe(200)
    expect(result.body.draft.vendorId).toBe('V001')
    expect(result.body.draft.vendorReference).toEqual(vendor)
    expect(result.body.draft.snapshot.vendorReference).toEqual(vendor)
  })
  it('allows an unresolved draft but blocks ready until a vendor is verified', async () => {
    vi.spyOn(vendorService, 'resolveVendor').mockResolvedValue({ vendor: null, issue: 'No Intacct vendor found.' })
    vi.spyOn(DeliveryDraft, 'create').mockImplementation(async (value) => value)
    const body = { site: 'Walpole', sourceHash: 'current', lines: [{ id: 'line', glAccountCode: 'stock' }] }
    expect((await request(app()).put('/tradogram/deliveries/abcdefghijkl/draft').set('Authorization', auth).send({ ...body, status: 'draft' })).status).toBe(200)
    expect((await request(app()).put('/tradogram/deliveries/abcdefghijkl/draft').set('Authorization', auth).send({ ...body, status: 'ready' })).status).toBe(422)
  })
})
