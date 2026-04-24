const express = require('express')
const { authenticate, requirePermission } = require('../../middleware/auth')

const router = express.Router()

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

router.get('/completions', authenticate, requirePermission('academy.completions', 'read'), async (req, res) => {
  try {
    const qs = req.query.courseId ? `?courseId=${req.query.courseId}` : ''
    const r = await hubFetch(`/api/academy/admin/completions${qs}`)
    const data = await r.json()
    if (!r.ok) return res.status(r.status).json(data)
    res.json(data.completions)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
