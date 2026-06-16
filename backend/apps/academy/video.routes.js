const express = require('express')
const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob')
const { authenticate, requirePermission } = require('../../middleware/auth')
const { jobs } = require('./video-jobs')

const router = express.Router()

const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000

// ── GET /videos/:videoId/status ───────────────────────────────────────────────
// Poll endpoint for async HLS transcoding jobs. Falls back to Azure blob
// existence check if the job isn't in memory (e.g., after a server restart).

router.get('/videos/:videoId/status', authenticate, requirePermission('academy.courses', 'update'), async (req, res) => {
  const { videoId } = req.params

  const job = jobs.get(videoId)
  if (job) return res.json(job)

  // Job not in memory — check Azure in case the server restarted mid-job
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  const containerName = process.env.AZURE_CONTAINER
  if (!connectionString || !containerName) {
    return res.status(500).json({ message: 'Azure storage not configured.' })
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const masterBlobName = `academy/videos/${videoId}/master.m3u8`
    const masterBlobClient = containerClient.getBlockBlobClient(masterBlobName)

    const exists = await masterBlobClient.exists()
    if (exists) {
      const props = await masterBlobClient.getProperties()
      const url = await masterBlobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse('r'),
        expiresOn: new Date(Date.now() + TEN_YEARS_MS),
      })
      return res.json({
        status: 'ready',
        file: {
          name: videoId,
          fullPath: masterBlobName,
          size: props.contentLength ?? 0,
          lastModified: props.lastModified?.toISOString() ?? null,
          contentType: 'application/vnd.apple.mpegurl',
          url,
          isHls: true,
        },
      })
    }

    // Blob doesn't exist yet — either still processing or the job was lost
    return res.json({ status: 'processing' })
  } catch (err) {
    console.error('[academy/videos/status] error:', err)
    res.status(500).json({ message: 'Failed to check status', error: err.message })
  }
})

module.exports = router
