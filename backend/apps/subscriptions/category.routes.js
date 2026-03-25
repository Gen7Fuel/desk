const express = require('express')
const router = express.Router()
const Category = require('./category.model')
const { authenticate, requirePermission } = require('../../middleware/auth')

// Get all categories
router.get('/subscriptions/categories', authenticate, requirePermission('admin.subscriptions.categories', 'read'), async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 })
    res.json(categories)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create a category
router.post('/subscriptions/categories', authenticate, requirePermission('admin.subscriptions.categories', 'create'), async (req, res) => {
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

// Delete a category
router.delete('/subscriptions/categories/:id', authenticate, requirePermission('admin.subscriptions.categories', 'delete'), async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id)
    if (!category) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
