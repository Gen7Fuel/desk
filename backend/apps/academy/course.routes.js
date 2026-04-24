const express = require('express')
const multer = require('multer')
const { BlobServiceClient } = require('@azure/storage-blob')
const { authenticate, requirePermission } = require('../../middleware/auth')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

function getHubConfig() {
  const base = process.env.ACADEMY_BASE
  const token = process.env.ACADEMY_ADMIN_TOKEN
  if (!base || !token) throw new Error('Academy not configured on server.')
  return { base, token }
}

async function hubFetch(path, options = {}) {
  const { base, token } = getHubConfig()
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
}

router.get('/courses', authenticate, requirePermission('academy.courses', 'read'), async (req, res) => {
  try {
    const r = await hubFetch('/api/academy/admin/courses')
    const data = await r.json()
    if (!r.ok) return res.status(r.status).json(data)
    res.json(data.courses)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/courses', authenticate, requirePermission('academy.courses', 'create'), async (req, res) => {
  try {
    const r = await hubFetch('/api/academy/admin/courses', { method: 'POST', body: JSON.stringify(req.body) })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/courses/:id', authenticate, requirePermission('academy.courses', 'read'), async (req, res) => {
  try {
    const r = await hubFetch(`/api/academy/admin/courses/${req.params.id}`)
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put('/courses/:id', authenticate, requirePermission('academy.courses', 'update'), async (req, res) => {
  try {
    const r = await hubFetch(`/api/academy/admin/courses/${req.params.id}`, { method: 'PUT', body: JSON.stringify(req.body) })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/courses/:id/publish', authenticate, requirePermission('academy.courses', 'update'), async (req, res) => {
  try {
    const r = await hubFetch(`/api/academy/admin/courses/${req.params.id}/publish`, { method: 'POST' })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/courses/:id/unpublish', authenticate, requirePermission('academy.courses', 'update'), async (req, res) => {
  try {
    const r = await hubFetch(`/api/academy/admin/courses/${req.params.id}/unpublish`, { method: 'POST' })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.delete('/courses/:id', authenticate, requirePermission('academy.courses', 'delete'), async (req, res) => {
  try {
    const r = await hubFetch(`/api/academy/admin/courses/${req.params.id}`, { method: 'DELETE' })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/upload', authenticate, requirePermission('academy.courses', 'update'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file provided.' })

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  const containerName = process.env.AZURE_VLS_CONTAINER

  if (!connectionString || !containerName) {
    return res.status(500).json({ message: 'Azure VLS storage not configured.' })
  }

  try {
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const blobName = `academy/${Date.now()}-${safeName}`
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.upload(req.file.buffer, req.file.size, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype },
    })

    res.json({ url: blockBlobClient.url })
  } catch (err) {
    console.error('[academy/upload] error:', err)
    res.status(500).json({ message: 'Upload failed', error: err.message })
  }
})

module.exports = router
