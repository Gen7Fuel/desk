const express = require('express')
const router = express.Router()
const Issue = require('./issue.model')
const { authenticate, requirePermission } = require('../../middleware/auth')

router.get(
  '/issues',
  authenticate,
  requirePermission('issues.tracker', 'read'),
  async (req, res) => {
    try {
      const { station, department, status } = req.query
      const filter = {}
      if (station) filter.station = { $regex: String(station), $options: 'i' }
      if (department) filter.department = department
      if (status) filter.status = status
      const issues = await Issue.find(filter).sort({ startDate: -1 }).lean()
      res.json(issues)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  },
)

router.post(
  '/issues',
  authenticate,
  requirePermission('issues.tracker', 'create'),
  async (req, res) => {
    try {
      const { station, issue, comments, department, assignee, startDate, notes, status } =
        req.body
      const created = await Issue.create({
        station,
        issue,
        comments,
        department,
        assignee,
        startDate,
        notes,
        status,
      })
      res.status(201).json(created)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  },
)

router.put(
  '/issues/:id',
  authenticate,
  requirePermission('issues.tracker', 'update'),
  async (req, res) => {
    try {
      const { station, issue, comments, department, assignee, startDate, notes, status } =
        req.body
      const updated = await Issue.findByIdAndUpdate(
        req.params.id,
        { station, issue, comments, department, assignee, startDate, notes, status },
        { new: true, runValidators: true },
      )
      if (!updated) return res.status(404).json({ error: 'Not found' })
      res.json(updated)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  },
)

router.delete(
  '/issues/:id',
  authenticate,
  requirePermission('issues.tracker', 'delete'),
  async (req, res) => {
    try {
      const deleted = await Issue.findByIdAndDelete(req.params.id)
      if (!deleted) return res.status(404).json({ error: 'Not found' })
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  },
)

module.exports = router
