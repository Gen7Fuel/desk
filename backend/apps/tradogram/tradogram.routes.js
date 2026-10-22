const express = require('express')
const { authenticate, requirePermission } = require('../../middleware/auth')
const { SiteAccount, DeliveryDraft } = require('./tradogram.model')
const service = require('./tradogram.service')
const vendorService = require('./tradogram.vendor')
const { getSettings } = require('./tradogram.settings')
const router = express.Router()
router.use(authenticate, requirePermission('hub.intacct', 'read'))
const write = requirePermission('hub.intacct', 'update')
const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const handle = (fn) => async (req, res) => {
  try { await fn(req, res) } catch (err) {
    res.status(err.code === 11000 ? 409 : err.status || 500).json({ message: err.code === 11000 ? 'This delivery was saved by another user. Reload before saving.' : err.status ? err.message : 'Unable to complete the Tradogram request.' })
  }
}

router.get('/settings', handle(async (_req, res) => { res.json(getSettings()) }))

router.get('/sites', handle(async (_req, res) => {
  res.json(await SiteAccount.find().sort({ site: 1 }).lean())
}))

router.get('/gl-accounts', handle(async (_req, res) => {
  res.json(await service.listGLAccounts())
}))

router.put('/sites', write, handle(async (req, res) => {
  const site = text(req.body.site)
  if (!site) throw service.error('Site is required.')
  const values = Object.fromEntries(['tradogramLocation', 'loanAccountId', 'inventoryAccountId'].map((key) => [key, text(req.body[key])]))
  if (values.loanAccountId || values.inventoryAccountId) service.validateSiteAccounts(values, await service.listGLAccounts())
  const saved = await SiteAccount.findOneAndUpdate({ site }, { $set: { ...values, updatedBy: req.user.email } }, { upsert: true, returnDocument: 'after', runValidators: true })
  res.json(saved)
}))

router.get('/deliveries', handle(async (req, res) => {
  const page = Number(req.query.page || 1)
  if (!Number.isInteger(page) || page < 1 || page > 1000) throw service.error('Page must be between 1 and 1000.')
  const result = await service.listDeliveries(page)
  const drafts = await DeliveryDraft.find({ deliveryCode: { $in: result.deliveries.map((d) => d.deliveryCode) } }).lean()
  res.json({ ...result, deliveries: result.deliveries.map((d) => {
    const saved = drafts.find((draft) => draft.deliveryCode === d.deliveryCode)
    return { ...d, site: saved?.site || '', status: saved ? (saved.snapshot?.modifiedDate !== d.modifiedDate ? 'needs-review' : saved.status) : 'new' }
  }) })
}))

router.get('/drafts', handle(async (_req, res) => {
  const drafts = await DeliveryDraft.find().sort({ updatedAt: -1 }).limit(200).lean()
  res.json(drafts.map((d) => ({ deliveryCode: d.deliveryCode, site: d.site, status: d.status, updatedAt: d.updatedAt,
    supplier: d.snapshot?.supplier, poNumber: d.snapshot?.poNumber, receivedDate: d.snapshot?.receivedDate,
    subtotal: d.snapshot?.subtotal, currency: d.snapshot?.currency,
  })))
}))

router.get('/deliveries/:code/vendor', handle(async (req, res) => {
  const source = await service.loadDelivery(req.params.code)
  res.json({ ...await vendorService.resolveVendor(source), sourceHash: source.sourceHash })
}))

router.get('/deliveries/:code', handle(async (req, res) => {
  const [source, accounts] = await Promise.all([service.loadDelivery(req.params.code), service.listGLAccounts()])
  const draft = await DeliveryDraft.findOne({ deliveryCode: req.params.code }).lean()
  const config = draft?.site ? await SiteAccount.findOne({ site: draft.site }).lean() : null
  const preview = service.prepare(source, draft || {}, config, accounts)
  res.json({ source, draft, accounts, stale: !!draft && (draft.sourceHash !== source.sourceHash || draft.configHash !== preview.configHash), preview })
}))

router.put('/deliveries/:code/draft', write, handle(async (req, res) => {
  const input = {
    site: text(req.body.site), invoiceNumber: text(req.body.invoiceNumber), notes: text(req.body.notes, 2000),
    lines: Array.isArray(req.body.lines) ? req.body.lines.map((line) => ({ id: text(line?.id), accountType: text(line?.accountType), glAccountCode: text(line?.glAccountCode) })) : [],
  }
  if (!['draft', 'ready'].includes(req.body.status) || input.lines.some((line) => !['', 'loan', 'inventory'].includes(line.accountType)) || new Set(input.lines.map((l) => l.id)).size !== input.lines.length) throw service.error('Invalid draft status or line selections.')
  const source = await service.loadDelivery(req.params.code)
  if (req.body.sourceHash !== source.sourceHash) throw service.error('Tradogram changed while you were reviewing. Reload the delivery before saving.', 409)
  const config = input.site ? await SiteAccount.findOne({ site: input.site }).lean() : null
  const reference = await vendorService.resolveVendor(source)
  input.vendorId = source.supplierAccountNumber || ''
  const preview = service.prepare(source, input, config, await service.listGLAccounts())
  if (reference.issue) preview.issues.push(reference.issue)
  if (req.body.status === 'ready' && preview.issues.length) return res.status(422).json({ message: preview.issues.join(' '), issues: preview.issues })
  const values = { ...input, lines: input.lines.map((line) => {
    const resolved = preview.lines.find((l) => l.id === line.id)
    return { ...line, accountType: resolved?.accountType || '', glAccountCode: resolved?.glAccountCode || line.glAccountCode }
  }), vendorReference: reference.vendor, status: req.body.status, sourceHash: source.sourceHash, configHash: preview.configHash,
    snapshot: { ...source, ...preview, vendorReference: reference.vendor, sageEntityId: getSettings().entityId }, updatedBy: req.user.email }
  let saved
  if (req.body.revision == null) saved = await DeliveryDraft.create({ ...values, deliveryCode: req.params.code })
  else {
    if (!Number.isInteger(req.body.revision) || req.body.revision < 1) throw service.error('Invalid draft revision.')
    saved = await DeliveryDraft.findOneAndUpdate({ deliveryCode: req.params.code, revision: req.body.revision, intacctBillKey: '' }, { $set: values, $inc: { revision: 1 } }, { returnDocument: 'after', runValidators: true })
    if (!saved) throw service.error('This delivery was changed or already posted. Reload before saving.', 409)
  }
  res.json({ draft: saved, preview, source, vendorReference: { ...reference, sourceHash: source.sourceHash } })
}))

module.exports = router
