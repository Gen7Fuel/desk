const express = require('express')
const router = express.Router()
const Credential = require('./credential.model')
const { authenticate, requirePermission } = require('../../middleware/auth')

// Create a credential
router.post('/credentials', authenticate, requirePermission('credentials.list', 'create'), async (req, res) => {
  try {
    const { name, category, url, username, password, notes } = req.body
    if (!name || !category || !username || !password) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const cred = await Credential.create({ name, category, url, username, password, notes })
    res.status(201).json(cred)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Get all credentials
router.get('/credentials', authenticate, requirePermission('credentials.list', 'read'), async (req, res) => {
  try {
    const creds = await Credential.find().sort({ category: 1, name: 1 })
    res.json(creds)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get a single credential
router.get('/credentials/:id', authenticate, requirePermission('credentials.list', 'read'), async (req, res) => {
  try {
    const cred = await Credential.findById(req.params.id)
    if (!cred) return res.status(404).json({ error: 'Not found' })
    res.json(cred)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update a credential
router.put('/credentials/:id', authenticate, requirePermission('credentials.list', 'update'), async (req, res) => {
  try {
    const { name, category, url, username, password, notes } = req.body
    const cred = await Credential.findByIdAndUpdate(
      req.params.id,
      { name, category, url, username, password, notes },
      { new: true }
    )
    if (!cred) return res.status(404).json({ error: 'Not found' })
    res.json(cred)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Delete a credential
router.delete('/credentials/:id', authenticate, requirePermission('credentials.list', 'delete'), async (req, res) => {
  try {
    const cred = await Credential.findByIdAndDelete(req.params.id)
    if (!cred) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
