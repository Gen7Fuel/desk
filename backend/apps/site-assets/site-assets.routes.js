const express = require('express')
const router = express.Router()
const SiteAsset = require('./site-assets.model')
const { authenticate, requirePermission } = require('../../middleware/auth')

const PERM = 'admin.site-assets'

// List assets (optional ?site= filter)
router.get('/site-assets', authenticate, requirePermission(PERM, 'read'), async (req, res) => {
  try {
    const filter = req.query.site ? { site: req.query.site } : {}
    const assets = await SiteAsset.find(filter).sort({ site: 1, category: 1, label: 1 })
    res.json(assets)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create asset
router.post('/site-assets', authenticate, requirePermission(PERM, 'create'), async (req, res) => {
  try {
    const { site, category, deviceType, label, serialNumber, photo } = req.body
    if (!site?.trim() || !category?.trim() || !deviceType?.trim() || !label?.trim()) {
      return res.status(400).json({ error: 'Site, category, device type, and label are required' })
    }
    const asset = await SiteAsset.create({
      site: site.trim(),
      category: category.trim(),
      deviceType: deviceType.trim(),
      label: label.trim(),
      serialNumber: serialNumber?.trim() ?? '',
      photo: photo ?? '',
    })
    res.status(201).json(asset)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Update asset
router.put('/site-assets/:id', authenticate, requirePermission(PERM, 'update'), async (req, res) => {
  try {
    const { site, category, deviceType, label, serialNumber, photo } = req.body
    if (!site?.trim() || !category?.trim() || !deviceType?.trim() || !label?.trim()) {
      return res.status(400).json({ error: 'Site, category, device type, and label are required' })
    }
    const asset = await SiteAsset.findByIdAndUpdate(
      req.params.id,
      {
        site: site.trim(),
        category: category.trim(),
        deviceType: deviceType.trim(),
        label: label.trim(),
        serialNumber: serialNumber?.trim() ?? '',
        photo: photo ?? '',
      },
      { returnDocument: 'after' }
    )
    if (!asset) return res.status(404).json({ error: 'Not found' })
    res.json(asset)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Delete asset
router.delete('/site-assets/:id', authenticate, requirePermission(PERM, 'delete'), async (req, res) => {
  try {
    const asset = await SiteAsset.findByIdAndDelete(req.params.id)
    if (!asset) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
