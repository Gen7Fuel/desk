const express = require('express')
const router = express.Router()
const FleetCard = require('./fleet-card.model')
const { authenticate, requirePermission } = require('../../middleware/auth')

const PERM = 'hub.fleetCards'

router.get('/fleet-cards', authenticate, requirePermission(PERM, 'read'), async (req, res) => {
  const cards = await FleetCard.find().sort({ accountName: 1, driverName: 1 })
  res.json(cards)
})

router.get('/fleet-cards/:id', authenticate, requirePermission(PERM, 'read'), async (req, res) => {
  const card = await FleetCard.findById(req.params.id)
  if (!card) return res.status(404).json({ error: 'Not found' })
  res.json(card)
})

router.post('/fleet-cards', authenticate, requirePermission(PERM, 'create'), async (req, res) => {
  const { cardNumber, accountName, driverName, numberPlate, makeModel, status, notes } = req.body
  if (!cardNumber || !accountName || !driverName || !numberPlate || !makeModel) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  const stripped = cardNumber.replace(/\s/g, '')
  if (!/^\d{16}$/.test(stripped)) {
    return res.status(400).json({ error: 'Card number must be exactly 16 digits' })
  }
  try {
    const card = await FleetCard.create({ cardNumber: stripped, accountName, driverName, numberPlate, makeModel, status, notes })
    res.status(201).json(card)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Card number already exists' })
    throw err
  }
})

router.put('/fleet-cards/:id', authenticate, requirePermission(PERM, 'update'), async (req, res) => {
  const { cardNumber, accountName, driverName, numberPlate, makeModel, status, notes } = req.body
  const update = { accountName, driverName, numberPlate, makeModel, status, notes }
  if (cardNumber !== undefined) {
    const stripped = cardNumber.replace(/\s/g, '')
    if (!/^\d{16}$/.test(stripped)) {
      return res.status(400).json({ error: 'Card number must be exactly 16 digits' })
    }
    update.cardNumber = stripped
  }
  try {
    const card = await FleetCard.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
    if (!card) return res.status(404).json({ error: 'Not found' })
    res.json(card)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Card number already exists' })
    throw err
  }
})

router.delete('/fleet-cards/:id', authenticate, requirePermission(PERM, 'delete'), async (req, res) => {
  const card = await FleetCard.findByIdAndDelete(req.params.id)
  if (!card) return res.status(404).json({ error: 'Not found' })
  res.json({ success: true })
})

module.exports = router
