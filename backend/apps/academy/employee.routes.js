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

router.get('/employees', authenticate, requirePermission('academy.employees', 'read'), async (req, res) => {
  try {
    const r = await hubFetch('/api/academy/admin/employees')
    const data = await r.json()
    if (!r.ok) return res.status(r.status).json(data)
    res.json(data.employees)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/employees', authenticate, requirePermission('academy.employees', 'create'), async (req, res) => {
  try {
    const r = await hubFetch('/api/academy/admin/employees', { method: 'POST', body: JSON.stringify(req.body) })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.delete('/employees/:id', authenticate, requirePermission('academy.employees', 'delete'), async (req, res) => {
  try {
    const r = await hubFetch(`/api/academy/admin/employees/${req.params.id}`, { method: 'DELETE' })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
