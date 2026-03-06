const express = require('express')
const router = express.Router()
const DeviceKind = require('./deviceKind.model')
const { authenticate, requirePermission } = require('../../middleware/auth')

// Get all device kinds
router.get('/', authenticate, requirePermission('assets.devices', 'read'), async (req, res) => {
  try {
    const kinds = await DeviceKind.find()
    res.json(kinds)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create device kind
router.post('/', authenticate, requirePermission('assets.devices', 'create'), async (req, res) => {
  try {
    const { name } = req.body
    const kind = await DeviceKind.create({ name })
    res.status(201).json(kind)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Update device kind
router.put('/:id', authenticate, requirePermission('assets.devices', 'update'), async (req, res) => {
  try {
    const { name } = req.body
    const kind = await DeviceKind.findByIdAndUpdate(req.params.id, { name }, { new: true })
    if (!kind) return res.status(404).json({ error: 'Not found' })
    res.json(kind)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Delete device kind
router.delete('/:id', authenticate, requirePermission('assets.devices', 'delete'), async (req, res) => {
  try {
    const kind = await DeviceKind.findByIdAndDelete(req.params.id)
    if (!kind) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
