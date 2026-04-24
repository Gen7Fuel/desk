const express = require('express')
const multer = require('multer')
const { BlobServiceClient } = require('@azure/storage-blob')
const { authenticate, requirePermission } = require('../../middleware/auth')
const Course = require('./course.model')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.get('/courses', authenticate, requirePermission('academy.courses', 'read'), async (req, res) => {
  const courses = await Course.find({}, 'title description thumbnail status sections createdAt').sort({ createdAt: -1 })
  res.json(
    courses.map((c) => ({
      _id: c._id,
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      status: c.status,
      sectionCount: c.sections.length,
      createdAt: c.createdAt,
    })),
  )
})

router.post('/courses', authenticate, requirePermission('academy.courses', 'create'), async (req, res) => {
  const { title, description, thumbnail, sections } = req.body
  if (!title) return res.status(400).json({ message: 'title is required' })
  const course = await Course.create({ title, description, thumbnail, sections: sections ?? [] })
  res.status(201).json(course)
})

router.get('/courses/:id', authenticate, requirePermission('academy.courses', 'read'), async (req, res) => {
  const course = await Course.findById(req.params.id)
  if (!course) return res.status(404).json({ message: 'Course not found.' })
  res.json(course)
})

router.put('/courses/:id', authenticate, requirePermission('academy.courses', 'update'), async (req, res) => {
  const { title, description, thumbnail, sections } = req.body
  if (!title) return res.status(400).json({ message: 'title is required' })
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    { title, description, thumbnail, sections },
    { new: true, runValidators: true },
  )
  if (!course) return res.status(404).json({ message: 'Course not found.' })
  res.json(course)
})

router.post('/courses/:id/publish', authenticate, requirePermission('academy.courses', 'update'), async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { status: 'published' }, { new: true })
  if (!course) return res.status(404).json({ message: 'Course not found.' })
  res.json(course)
})

router.post('/courses/:id/unpublish', authenticate, requirePermission('academy.courses', 'update'), async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { status: 'draft' }, { new: true })
  if (!course) return res.status(404).json({ message: 'Course not found.' })
  res.json(course)
})

router.delete('/courses/:id', authenticate, requirePermission('academy.courses', 'delete'), async (req, res) => {
  const course = await Course.findByIdAndDelete(req.params.id)
  if (!course) return res.status(404).json({ message: 'Course not found.' })
  res.json({ success: true })
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
