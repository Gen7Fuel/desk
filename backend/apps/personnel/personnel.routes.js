const express = require('express')
const router = express.Router()
const Personnel = require('./personnel.model')
const ResourceKind = require('../access/resourceKind.model')
const { authenticate, requirePermission } = require('../../middleware/auth')

// Get all personnel
router.get('/', authenticate, requirePermission('admin.personnel', 'read'), async (req, res) => {
  try {
    const people = await Personnel.find()
    res.json(people)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get one personnel by id
router.get('/:id', authenticate, requirePermission('admin.personnel', 'read'), async (req, res) => {
  try {
    const person = await Personnel.findById(req.params.id)
    if (!person) return res.status(404).json({ error: 'Not found' })
    res.json(person)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Helper to validate that all resource types exist in ResourceKind
async function validateResourceTypes(resources = []) {
  if (!Array.isArray(resources) || resources.length === 0) return
  const types = [...new Set(resources.map((r) => r.type).filter(Boolean))]
  if (types.length === 0) return
  const kinds = await ResourceKind.find({ name: { $in: types } }).select('name')
  const foundNames = new Set(kinds.map((k) => k.name))
  const missing = types.filter((t) => !foundNames.has(t))
  if (missing.length > 0) {
    const err = new Error(`Unknown resource types: ${missing.join(', ')}`)
    err.statusCode = 400
    throw err
  }
}

// Create personnel
router.post('/', authenticate, requirePermission('admin.personnel', 'create'), async (req, res) => {
  try {
    // Validate resource types, if provided
    if (req.body && Array.isArray(req.body.resources)) {
      await validateResourceTypes(req.body.resources)
    }
    const person = await Personnel.create(req.body)
    res.status(201).json(person)
  } catch (err) {
    const status = err.statusCode || 400
    res.status(status).json({ error: err.message })
  }
})

// Update personnel
router.put('/:id', authenticate, requirePermission('admin.personnel', 'update'), async (req, res) => {
  try {
    // Validate resource types, if provided
    if (req.body && Array.isArray(req.body.resources)) {
      await validateResourceTypes(req.body.resources)
    }
    const person = await Personnel.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' })
    if (!person) return res.status(404).json({ error: 'Not found' })
    res.json(person)
  } catch (err) {
    const status = err.statusCode || 400
    res.status(status).json({ error: err.message })
  }
})

// Delete personnel
router.delete('/:id', authenticate, requirePermission('admin.personnel', 'delete'), async (req, res) => {
  try {
    const person = await Personnel.findByIdAndDelete(req.params.id)
    if (!person) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
