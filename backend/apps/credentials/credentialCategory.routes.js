const express = require('express')
const router = express.Router()
const Category = require('./credentialCategory.model')
const { authenticate, requirePermission } = require('../../middleware/auth')

// Get all categories
router.get('/credentials/categories', authenticate, requirePermission('admin.credentials.categories', 'read'), async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 })
    res.json(categories)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get single category
router.get('/credentials/categories/:id', authenticate, requirePermission('admin.credentials.categories', 'read'), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) return res.status(404).json({ error: 'Not found' })
    res.json(category)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create a category
router.post('/credentials/categories', authenticate, requirePermission('admin.credentials.categories', 'create'), async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' })
    const category = await Category.create({ name: name.trim() })
    res.status(201).json(category)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Category already exists' })
    res.status(400).json({ error: err.message })
  }
})

// Update a category
router.put('/credentials/categories/:id', authenticate, requirePermission('admin.credentials.categories', 'update'), async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' })
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name: name.trim() },
      { returnDocument: 'after' }
    )
    if (!category) return res.status(404).json({ error: 'Not found' })
    res.json(category)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Category already exists' })
    res.status(400).json({ error: err.message })
  }
})

// Delete a category
router.delete('/credentials/categories/:id', authenticate, requirePermission('admin.credentials.categories', 'delete'), async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id)
    if (!category) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
