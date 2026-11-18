const express = require('express')
const { authenticate, requirePermission } = require('../../middleware/auth')
const service = require('./bookworks.service')

function createRouter(client, draftIntegration) {
  const integration = draftIntegration || require('./bookworks.drafts').createIntegration({ client })
  const router = express.Router()
  router.use(authenticate, requirePermission('hub.intacct', 'read'))
  router.get('/invoices', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const rawOffset = req.query.offset ?? '0'
    if (typeof rawOffset !== 'string' || !/^\d+$/.test(rawOffset)) {
      return res.status(400).json({ message: 'Invalid invoice page.' })
    }
    try {
      return res.json(await service.searchInvoices(req.query.invoiceNumber, Number(rawOffset), client))
    } catch (err) {
      return res.status(err.status || 500).json({ message: err.status ? err.message : 'Invoice lookup failed. Please retry.' })
    }
  })
  const write = requirePermission('hub.intacct', 'update')
  const handle = fn => async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try { res.json(await fn(req)) }
    catch (err) { res.status(err.status || 500).json({ message: err.status ? err.message : 'Bookworks Intacct request failed. Please retry.' }) }
  }
  const id = req => {
    if (!/^[1-9]\d*$/.test(req.params.invoiceId) || !Number.isSafeInteger(Number(req.params.invoiceId))) throw Object.assign(new Error('Invalid Bookworks invoice ID.'), { status: 400 })
    return Number(req.params.invoiceId)
  }
  const actor = req => String(req.user.email || req.user.userId || '')
  router.get('/intacct/vendors', handle(req => integration.vendors(req.query.q)))
  router.get('/invoices/:invoiceId/intacct-context', handle(req => integration.context(id(req))))
  router.put('/invoices/:invoiceId/vendor-mapping', write, express.json({ limit: '16kb' }), handle(req => integration.saveMapping(id(req), req.body?.vendorId, actor(req))))
  router.post('/invoices/:invoiceId/draft-preview', write, express.json({ limit: '16kb' }), handle(req => integration.preview(id(req), req.body?.cogsType)))
  router.post('/invoices/:invoiceId/intacct-draft', write, express.json({ limit: '16kb' }), handle(req => integration.createDraft(id(req), { cogsType: req.body?.cogsType, previewHash: req.body?.previewHash }, actor(req))))
  return router
}

module.exports = createRouter()
module.exports.createRouter = createRouter
