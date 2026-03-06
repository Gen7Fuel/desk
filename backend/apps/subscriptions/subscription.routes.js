const express = require('express')
const router = express.Router()
const Subscription = require('./subscription.model')
const { authenticate, requirePermission } = require('../../middleware/auth')

// Create a subscription
router.post('/subscriptions', authenticate, requirePermission('subscriptions.list', 'create'), async (req, res) => {
  const { category, identifier, price, billing_cycle, end_date, notes } = req.body
  if (!category || !identifier || price == null || !billing_cycle || !end_date) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  const sub = await Subscription.create({ category, identifier, price, billing_cycle, end_date, notes })
  res.status(201).json(sub)
})

// Get all subscriptions
router.get('/subscriptions', authenticate, requirePermission('subscriptions.list', 'read'), async (req, res) => {
  const subs = await Subscription.find().sort({ createdAt: -1 })
  res.json(subs)
})

// Get a single subscription
router.get('/subscriptions/:id', authenticate, requirePermission('subscriptions.list', 'read'), async (req, res) => {
  const sub = await Subscription.findById(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Not found' })
  res.json(sub)
})

// Update a subscription
router.put('/subscriptions/:id', authenticate, requirePermission('subscriptions.list', 'update'), async (req, res) => {
  const { category, identifier, price, billing_cycle, end_date, notes } = req.body
  const sub = await Subscription.findByIdAndUpdate(
    req.params.id,
    { category, identifier, price, billing_cycle, end_date, notes },
    { returnDocument: 'after' }
  )
  if (!sub) return res.status(404).json({ error: 'Not found' })
  res.json(sub)
})

// Delete a subscription
router.delete('/subscriptions/:id', authenticate, requirePermission('subscriptions.list', 'delete'), async (req, res) => {
  const sub = await Subscription.findByIdAndDelete(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Not found' })
  res.json({ success: true })
})

module.exports = router
