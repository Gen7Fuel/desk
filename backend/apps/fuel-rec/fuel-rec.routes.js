const express = require('express')
const { authenticate, requirePermission } = require('../../middleware/auth')
const BOLPhoto = require('./fuel-rec.model')

const router = express.Router()

const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

// GET /api/fuel-rec/list?site=...&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/fuel-rec/list', authenticate, async (req, res) => {
  try {
    const site = String(req.query?.site || '').trim()
    let from = String(req.query?.from || '').trim()
    let to = String(req.query?.to || '').trim()

    if (!site) return res.status(400).json({ error: 'site is required' })
    if (from && !isYmd(from)) return res.status(400).json({ error: 'from must be YYYY-MM-DD' })
    if (to && !isYmd(to)) return res.status(400).json({ error: 'to must be YYYY-MM-DD' })

    if (from && to && from > to) [from, to] = [to, from]

    const filter = { site }
    if (from || to) {
      const range = {}
      if (from) range.$gte = from
      if (to) range.$lte = to
      filter.date = range
    }

    const entries = await BOLPhoto.find(filter).sort({ date: -1, createdAt: -1 }).lean()

    return res.json({ site, from: from || null, to: to || null, count: entries.length, entries })
  } catch (e) {
    console.error('fuelRec.list error:', e)
    return res.status(500).json({ error: 'Failed to list BOL photos' })
  }
})

// DELETE /api/fuel-rec/:id
router.delete(
  '/fuel-rec/:id',
  authenticate,
  requirePermission('accounting.fuelRec', 'delete'),
  async (req, res) => {
    try {
      const id = String(req.params.id || '').trim()
      if (!id) return res.status(400).json({ error: 'id is required' })

      const deleted = await BOLPhoto.findByIdAndDelete(id).lean()
      if (!deleted) return res.status(404).json({ error: 'Entry not found' })

      return res.json({ deleted: true, id })
    } catch (e) {
      console.error('fuelRec.delete error:', e)
      return res.status(500).json({ error: 'Failed to delete BOL photo' })
    }
  },
)

// POST /api/fuel-rec/:id/comment
router.post('/fuel-rec/:id/comment', authenticate, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim()
    const text = String(req.body?.text || '').trim()
    if (!id || !text) return res.status(400).json({ error: 'id and text are required' })

    const user = (req.user && (req.user.name || req.user.email)) || 'Unknown'

    const updated = await BOLPhoto.findByIdAndUpdate(
      id,
      { $push: { comments: { text, createdAt: new Date(), user } } },
      { new: true, lean: true },
    )
    if (!updated) return res.status(404).json({ error: 'Entry not found' })

    return res.json({ ok: true, comments: updated.comments })
  } catch (e) {
    console.error('fuelRec.comment error:', e)
    return res.status(500).json({ error: 'Failed to add comment' })
  }
})

module.exports = router
