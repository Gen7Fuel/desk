const express = require('express')
const router = express.Router()
const Location = require('./location.model')
const { authenticate, requirePermission } = require('../../middleware/auth')

// Get all locations
router.get('/', authenticate, requirePermission('admin.assets.location', 'read'), async (req, res) => {
  try {
    const locations = await Location.find()
    res.json(locations)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create location
router.post('/', authenticate, requirePermission('admin.assets.location', 'create'), async (req, res) => {
  try {
    const { name, lat, lng } = req.body
    const location = await Location.create({ name, lat, lng })
    res.status(201).json(location)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Update location (name, lat, lng)
router.put('/:id', authenticate, requirePermission('admin.assets.location', 'update'), async (req, res) => {
  try {
    const { name, lat, lng } = req.body
    const update = {}
    if (name !== undefined) update.name = name
    if (lat !== undefined) update.lat = lat
    if (lng !== undefined) update.lng = lng
    const location = await Location.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true })
    if (!location) return res.status(404).json({ error: 'Not found' })
    res.json(location)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Delete location
router.delete('/:id', authenticate, requirePermission('admin.assets.location', 'delete'), async (req, res) => {
  try {
    const location = await Location.findByIdAndDelete(req.params.id)
    if (!location) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
