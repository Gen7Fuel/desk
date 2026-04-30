const express = require('express')
const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob')
const { authenticate, requirePermission } = require('../../middleware/auth')

const router = express.Router()

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

    for await (const blob of containerClient.listBlobsFlat({ prefix: 'hub/academy/' })) {
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name)
      const url = await blockBlobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse('r'),
        expiresOn,
      })
      files.push({
        name: blob.name.slice('hub/academy/'.length),
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

module.exports = router
