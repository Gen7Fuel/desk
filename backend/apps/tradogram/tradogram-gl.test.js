const request = require('supertest')
const express = require('express')
const service = require('./tradogram.service')
const vendorService = require('./tradogram.vendor')
const { SiteAccount, DeliveryDraft } = require('./tradogram.model')
const { authHeader } = require('../../tests/helpers/auth')
const auth = authHeader({ permissions: { hub: { intacct: { read: true, update: true } } } })
const app = () => express().use(express.json()).use('/tradogram', require('./tradogram.routes'))
const accounts = [
  { code: 'loan-1', name: 'Loan Walpole', number: '16250', type: 'loan' },
  { code: 'loan-2', name: 'Loan Another Site', number: '16251', type: 'loan' },
  { code: 'stock', name: 'Station Build Inventory', number: '10760', type: 'inventory' },
]
const config = { site: 'Walpole', sageLocationId: 'T010', loanAccountId: '16250', inventoryAccountId: '10760' }
const source = { sourceHash: 'current', supplierAccountNumber: 'V1', issues: [], subtotal: 500, lines: [{ id: 'line1', name: 'Pump' }] }
beforeEach(() => { vi.spyOn(vendorService, 'resolveVendor').mockResolvedValue({ vendor: { id: 'V1', key: '1', name: 'Supplier', status: 'active', entityId: 'T010' }, issue: '' }) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Tradogram debit account catalogue', () => {
  it('reads all pages and excludes AP, inactive accounts and ambiguous categories', async () => {
    vi.stubEnv('TRADOGRAM_API_KEY', 'test-token')
    const raw = (code, name, number, active = true) => ({ GLAccountCode: code, GLAccountName: name, GLAccountNumber: number, IsActive: active })
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ HasMorePages: true, GLAccounts: [raw('a', 'Loan Walpole', '16250'), raw('b', 'Accounts Payable - trade', '20010')] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ HasMorePages: false, GLAccounts: [raw('c', 'Station Build Inventory', '10760'), raw('d', 'Loan Closed Site', '16251', false), raw('e', 'Loan Inventory', '999')] }) })
    vi.stubGlobal('fetch', fetch)
    const result = await service.listGLAccounts()
    expect(result.map((a) => a.number).sort()).toEqual(['10760', '16250'])
    expect(fetch.mock.calls[1][0].searchParams.get('page')).toBe('2')
  })
  it('fails loudly if upstream repeats a page rather than returning a partial catalogue', async () => {
    vi.stubEnv('TRADOGRAM_API_KEY', 'test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ HasMorePages: true, GLAccounts: [{ GLAccountCode: 'repeat', GLAccountName: 'Loan Site', GLAccountNumber: '16250', IsActive: true }] }) }))
    await expect(service.listGLAccounts()).rejects.toThrow('repeated GL accounts')
  })
  it('preserves PO GL references for matching received lines', () => {
    const normalized = service.normalize({ POStatus: 'In Delivery', IsBooked: true, ReceiveDate: '2026-10-22', DeliveryItems: [{ DeliveryItemCode: 'd', LineItemCode: 'p', QtyReceived: '2' }] }, { Currency: 'CAD', LineItems: [{ LineItemCode: 'p', UnitPrice: '5', GLAccountName: 'Loan Walpole', GLAccountNumber: '16250' }] })
    expect(normalized.lines[0]).toMatchObject({ poGLAccountName: 'Loan Walpole', poGLAccountNumber: '16250' })
  })
  it('uses an explicitly selected account and derives the type/number server-side', () => {
    const preview = service.prepare(source, { site: 'Walpole', vendorId: 'V1', lines: [{ id: 'line1', accountType: 'inventory', glAccountCode: 'loan-2' }] }, config, accounts)
    expect(preview.issues).toEqual([])
    expect(preview.lines[0]).toMatchObject({ accountType: 'loan', accountId: '16251', glAccountCode: 'loan-2' })
    expect(service.prepare(source, { site: 'Walpole', vendorId: 'V1', lines: [{ id: 'line1', accountType: 'loan', glAccountCode: 'removed' }] }, config, accounts).issues.join(' ')).toContain('Choose a unique active')
  })
  it('rejects incorrect or ambiguous site defaults', () => {
    expect(() => service.validateSiteAccounts(config, accounts)).not.toThrow()
    expect(() => service.validateSiteAccounts({ ...config, loanAccountId: '20010' }, accounts)).toThrow('active loan')
    expect(() => service.validateSiteAccounts({ ...config, loanAccountId: '10760' }, accounts)).toThrow('active loan')
    expect(() => service.validateSiteAccounts(config, [...accounts, { ...accounts[0], code: 'duplicate' }])).toThrow('unique active')
  })
  it('includes the resolved selection in the stale-review fingerprint', () => {
    const input = { site: 'Walpole', vendorId: 'V1', lines: [{ id: 'line1', glAccountCode: 'loan-1' }] }
    const old = service.prepare(source, input, config, accounts)
    expect(service.prepare(source, input, config, accounts.map((a) => a.code === 'loan-1' ? { ...a, number: '16299' } : a)).configHash).not.toBe(old.configHash)
  })
})

describe('GL account route validation', () => {
  it('protects the catalogue behind Desk authentication', async () => {
    expect((await request(app()).get('/tradogram/gl-accounts')).status).toBe(401)
    vi.spyOn(service, 'listGLAccounts').mockResolvedValue(accounts)
    expect((await request(app()).get('/tradogram/gl-accounts').set('Authorization', auth)).body).toEqual(accounts)
  })
  it('rejects AP or unknown GL codes when marking a bill ready', async () => {
    vi.spyOn(service, 'loadDelivery').mockResolvedValue(source)
    vi.spyOn(service, 'listGLAccounts').mockResolvedValue(accounts)
    vi.spyOn(SiteAccount, 'findOne').mockReturnValue({ lean: async () => config })
    const create = vi.spyOn(DeliveryDraft, 'create')
    const result = await request(app()).put('/tradogram/deliveries/abcdefghijkl/draft').set('Authorization', auth).send({ site: 'Walpole', vendorId: 'V1', status: 'ready', sourceHash: 'current', lines: [{ id: 'line1', glAccountCode: 'ap-account' }] })
    expect(result.status).toBe(422)
    expect(create).not.toHaveBeenCalled()
  })
  it('persists the selected catalogue code and server-resolved account type', async () => {
    vi.spyOn(service, 'loadDelivery').mockResolvedValue(source)
    vi.spyOn(service, 'listGLAccounts').mockResolvedValue(accounts)
    vi.spyOn(SiteAccount, 'findOne').mockReturnValue({ lean: async () => config })
    vi.spyOn(DeliveryDraft, 'create').mockImplementation(async (value) => value)
    const result = await request(app()).put('/tradogram/deliveries/abcdefghijkl/draft').set('Authorization', auth).send({ site: 'Walpole', vendorId: 'V1', status: 'ready', sourceHash: 'current', lines: [{ id: 'line1', glAccountCode: 'stock' }] })
    expect(result.status).toBe(200)
    expect(result.body.draft.lines[0]).toMatchObject({ glAccountCode: 'stock', accountType: 'inventory' })
    expect(result.body.draft.snapshot.lines[0].accountId).toBe('10760')
  })
})
