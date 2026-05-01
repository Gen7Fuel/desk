const express = require('express')
const multer = require('multer')
const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob')
const { authenticate, requirePermission } = require('../../middleware/auth')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.get('/media', authenticate, requirePermission('academy.courses', 'read'), async (req, res) => {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  const containerName = process.env.AZURE_CONTAINER

  if (!connectionString || !containerName) {
    return res.status(500).json({ message: 'Azure storage not configured.' })
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    const expiresOn = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    const files = []

    for await (const blob of containerClient.listBlobsFlat({ prefix: 'academy/' })) {
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name)
      const url = await blockBlobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse('r'),
        expiresOn,
      })
      files.push({
        name: blob.name.slice('academy/'.length),
        fullPath: blob.name,
        size: blob.properties.contentLength ?? 0,
        lastModified: blob.properties.lastModified?.toISOString() ?? null,
        contentType: blob.properties.contentType ?? '',
        url,
      })
    }

    res.json({ files })
  } catch (err) {
    console.error('[academy/media] error:', err)
    res.status(500).json({ message: 'Failed to list media', error: err.message })
  }
})

router.get('/media/sas', authenticate, requirePermission('academy.courses', 'update'), async (req, res) => {
  const blobPath = String(req.query.path || '').trim()
  if (!blobPath) return res.status(400).json({ message: 'path is required' })

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  const containerName = process.env.AZURE_CONTAINER

  if (!connectionString || !containerName) {
    return res.status(500).json({ message: 'Azure storage not configured.' })
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath)

    const url = await blockBlobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
    })

    res.json({ url })
  } catch (err) {
    console.error('[academy/media/sas] error:', err)
    res.status(500).json({ message: 'Failed to generate URL', error: err.message })
  }
})

router.post('/media/upload', authenticate, requirePermission('academy.courses', 'update'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file provided.' })

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  const containerName = process.env.AZURE_CONTAINER

  if (!connectionString || !containerName) {
    return res.status(500).json({ message: 'Azure storage not configured.' })
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blobName = `academy/${req.file.originalname}`
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype },
      overwrite: true,
    })

    const expiresOn = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const url = await blockBlobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      expiresOn,
    })

    res.json({
      name: req.file.originalname,
      fullPath: blobName,
      size: req.file.size,
      lastModified: new Date().toISOString(),
      contentType: req.file.mimetype,
      url,
    })
  } catch (err) {
    console.error('[academy/media/upload] error:', err)
    res.status(500).json({ message: 'Upload failed', error: err.message })
  }
})

module.exports = router
