const express = require('express')
const router = express.Router()
const Cipher = require('./cipher.model')
const { encrypt, decrypt } = require('../../utils/crypto')
const { authenticate, requirePermission } = require('../../middleware/auth')

// POST /api/encrypt
router.post('/encrypt', authenticate, requirePermission('cipher.lock', 'create'), async (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'Missing text' })
  const { encrypted, key, iv, tag } = encrypt(text)
  const doc = await Cipher.create({ encrypted, iv, tag })
  res.json({ id: doc._id, key })
})

// POST /api/decrypt
router.post('/decrypt', authenticate, requirePermission('cipher.unlock', 'read'), async (req, res) => {
  const { id, key } = req.body
  if (!id || !key) return res.status(400).json({ error: 'Missing id or key' })
  const doc = await Cipher.findById(id)
  if (!doc) return res.status(404).json({ error: 'Not found' })
  try {
    const text = decrypt(doc.encrypted, key, doc.iv, doc.tag)
    res.json({ text })
  } catch (e) {
    res.status(401).json({ error: 'Invalid key or corrupted data' })
  }
})

module.exports = router
