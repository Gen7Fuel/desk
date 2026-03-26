const express = require('express')
const router = express.Router()
const Log = require('./log.model')
const { authenticate, requirePermission } = require('../../middleware/auth')

// POST /api/logs — any authenticated user can write audit logs
router.post('/logs', authenticate, async (req, res) => {
  try {
    const { app, action, entityId, field, oldValue, newValue, entitySnapshot, severity } =
      req.body
    const log = await Log.create({
      app,
      action,
      entityId,
      user: {
        id: req.user.userId || req.user.id,
        email: req.user.email,
      },
      field,
      oldValue,
      newValue,
      entitySnapshot,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
      severity: severity || 'info',
      status: 'success',
    })
    res.status(201).json(log)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/logs — requires settings.logs read permission
router.get('/logs', authenticate, requirePermission('settings.logs', 'read'), async (req, res) => {
  try {
    const { app, action, from, to, page = '1', limit = '50' } = req.query

    const filter = {}
    if (app) filter.app = app
    if (action) filter.action = action
    if (from || to) {
      filter.timestamp = {}
      if (from) filter.timestamp.$gte = new Date(String(from))
      if (to) filter.timestamp.$lte = new Date(String(to))
    }

    const pageNum = Math.max(1, parseInt(String(page), 10))
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)))
    const skip = (pageNum - 1) * limitNum

    const [logs, total] = await Promise.all([
      Log.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limitNum).lean(),
      Log.countDocuments(filter),
    ])

    res.json({ logs, total, page: pageNum, limit: limitNum })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
