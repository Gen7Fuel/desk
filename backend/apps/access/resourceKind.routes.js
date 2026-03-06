const express = require('express')
const router = express.Router()
const ResourceKind = require('./resourceKind.model')
const { authenticate, requirePermission } = require('../../middleware/auth')


// Get all resource kinds (no order)
router.get('/', authenticate, requirePermission('access.resources', 'read'), async (req, res) => {
  try {
    const kinds = await ResourceKind.find()
    res.json(kinds)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// Create resource kind
router.post('/', authenticate, requirePermission('access.resources', 'create'), async (req, res) => {
  try {
    const { name } = req.body
    const kind = await ResourceKind.create({ name })
    res.status(201).json(kind)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})


// Update resource kind
router.put('/:id', authenticate, requirePermission('access.resources', 'update'), async (req, res) => {
  try {
    const { name } = req.body
    const kind = await ResourceKind.findByIdAndUpdate(req.params.id, { name }, { new: true })
    if (!kind) return res.status(404).json({ error: 'Not found' })
    res.json(kind)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Delete resource kind
router.delete('/:id', authenticate, requirePermission('access.resources', 'delete'), async (req, res) => {
  try {
    const kind = await ResourceKind.findByIdAndDelete(req.params.id)
    if (!kind) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
