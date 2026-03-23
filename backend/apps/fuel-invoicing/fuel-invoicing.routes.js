const express = require('express')
const multer = require('multer')
// const { BlobServiceClient } = require('@azure/storage-blob')
const { authenticate, requirePermission } = require('../../middleware/auth')
const Kardpoll = require('./kardpoll.model')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/fuel-invoicing/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided.' })
    }

    console.log('[fuel-invoicing/upload] originalname:', req.file.originalname)

    // TODO: re-enable Azure upload when ready
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
    const containerName = process.env.AZURE_CONTAINER
    
    if (!connectionString || !containerName) {
      return res.status(500).json({ message: 'Azure storage not configured.' })
    }
    
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)
    
    const blobName = `cdn_backup/${req.file.originalname}`
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)
    
    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype },
    })

    return res.status(200).json({ message: 'File received successfully.' })
  } catch (err) {
    console.error('[fuel-invoicing/upload] error:', err)
    return res.status(500).json({ message: 'Failed to process file.' })
  }
})

router.post(
  '/fuel-invoicing/parse-kardpoll-excel',
  authenticate,
  requirePermission('fuelInvoicing', 'create'),
  async (req, res) => {
    const { site, date, totalSales, totalLitres } = req.body

    if (!site || !date || !totalSales || !totalLitres) {
      return res.status(400).json({ message: 'site, date, totalSales, and totalLitres are required.' })
    }

    try {
      const entry = await Kardpoll.create({ site, date, totalSales, totalLitres })
      return res.status(201).json(entry)
    } catch (err) {
      console.error('[fuel-invoicing/parse-kardpoll-excel] error:', err)
      return res.status(500).json({ message: 'Failed to save kardpoll entry.' })
    }
  },
)

module.exports = router
