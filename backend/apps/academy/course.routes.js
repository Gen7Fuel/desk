const express = require('express')
const multer = require('multer')
const { authenticate, requirePermission } = require('../../middleware/auth')
const { blobPathFromUrl, isCourseOwnedPath, mediaKey, courseReferencesMedia } = require('./media-references')
const mediaStorage = require('./media-storage')

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

// Every course with its sections, for checking whether a video is still used.
// Throws if any lookup fails, so the caller never deletes on partial information.
async function getAllCoursesWithSections() {
  const listRes = await hubFetch('/api/academy/admin/courses')
  const list = await listRes.json()
  if (!listRes.ok) throw new Error(`Failed to list courses (${listRes.status})`)
  const courses = []
  for (const summary of list.courses ?? []) {
    const r = await hubFetch(`/api/academy/admin/courses/${summary._id}`)
    const data = await r.json()
    if (!r.ok) throw new Error(`Failed to load course ${summary._id} (${r.status})`)
    courses.push(data.course ?? data)
  }
  return courses
}

/**
 * POST /courses/:id/release-media  { url }
 * Called after a course is saved with a video swapped out or cleared. Deletes
 * the old video from storage only if it lives in this course's own folder AND
 * no saved course (this one included) still references it. Never throws away
 * media on doubt: any failed check means "keep it".
 * Responds { released: boolean, reason?: string }.
 */
router.post('/courses/:id/release-media', authenticate, requirePermission('academy.courses', 'update'), async (req, res) => {
  const url = typeof req.body?.url === 'string' ? req.body.url : ''
  if (!url) return res.status(400).json({ message: 'url is required' })

  const containerName = process.env.AZURE_CONTAINER
  const blobPath = blobPathFromUrl(url, containerName)
  if (!blobPath) return res.json({ released: false, reason: 'not-in-storage' })
  if (!isCourseOwnedPath(blobPath, req.params.id)) return res.json({ released: false, reason: 'not-in-course-folder' })

  try {
    const key = mediaKey(blobPath)
    const courses = await getAllCoursesWithSections()
    if (courses.some((c) => courseReferencesMedia(c, key, containerName))) {
      return res.json({ released: false, reason: 'in-use' })
    }
    await mediaStorage.deleteMediaAtPath(blobPath)
    res.json({ released: true })
  } catch (err) {
    console.error('[academy/release-media] error:', err)
    res.status(500).json({ message: 'Could not release media', error: err.message })
  }
})

router.post('/upload', authenticate, requirePermission('academy.courses', 'update'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file provided.' })

  const cdnBase = process.env.CDN_BASE
  if (!cdnBase) return res.status(500).json({ message: 'CDN not configured.' })

  try {
    const form = new FormData()
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname)

    const response = await fetch(`${cdnBase}/cdn/upload`, { method: 'POST', body: form })
    if (!response.ok) throw new Error(`CDN responded with ${response.status}`)

    const { filename } = await response.json()
    res.json({ url: `${cdnBase}/cdn/download/${filename}` })
  } catch (err) {
    console.error('[academy/upload] error:', err)
    res.status(500).json({ message: 'Upload failed', error: err.message })
  }
})

module.exports = router
