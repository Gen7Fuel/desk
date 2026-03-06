const express = require('express')
const jwt = require('jsonwebtoken')
const router = express.Router()

const User = require('../users/user.model')
const Role = require('../roles/role.model')
const { resolvePermissions, buildDefaultPermissions } = require('../../lib/permissions')

const JWT_SECRET = process.env.JWT_SECRET || 'desk-dev-secret'

router.post('/auth/login', async (req, res) => {
  try {
    // Forward credentials to the external auth provider
    const response = await fetch('https://app.gen7fuel.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })

    const text = await response.text()
    console.log('[auth/login] status:', response.status)

    let data = null
    try { data = JSON.parse(text) } catch { data = { message: text } }

    if (!response.ok) {
      return res.status(response.status).json(data ?? { message: 'Login failed.' })
    }

    // Look up the user in our DB by email to resolve permissions
    const email = req.body.email
    console.log('[auth] step 1 - email:', email)

    let permissions = buildDefaultPermissions(false)

    // Auto-create a user doc on first login so they can be assigned a role later
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $setOnInsert: { email: email.toLowerCase(), role: null, permissionOverrides: {} } },
      { upsert: true, new: true },
    )
    console.log('[auth] step 2 - user.role:', user.role)
    console.log('[auth] step 2 - permissionOverrides keys:', Object.keys(user.permissionOverrides || {}))

    if (user && user.role) {
      const role = await Role.findOne({ name: user.role })
      console.log('[auth] step 3 - role found:', !!role)
      if (role) {
        // Use .toObject() to guarantee a plain JS object — Mongoose Mixed can
        // have a non-standard prototype that breaks JSON.parse(JSON.stringify())
        const roleDoc = role.toObject()
        const userDoc = user.toObject()
        const rolePerms = roleDoc.permissions
        const userOverrides = userDoc.permissionOverrides || {}

        console.log('[auth] step 3 - rolePerms sample (fuelInvoicing):', JSON.stringify(rolePerms?.fuelInvoicing))
        console.log('[auth] step 3 - rolePerms sample (settings):', JSON.stringify(rolePerms?.settings))
        console.log('[auth] step 3 - userOverrides keys:', Object.keys(userOverrides))

        permissions = resolvePermissions(rolePerms, userOverrides)

        const trueCount = countTrues(permissions)
        console.log('[auth] step 4 - resolved permissions true count:', trueCount)
        console.log('[auth] step 4 - sample (fuelInvoicing):', JSON.stringify(permissions?.fuelInvoicing))
      } else {
        console.log('[auth] step 3 - role not found for name:', user.role, '— using all-false defaults')
      }
    } else {
      console.log('[auth] step 2 - user has no role assigned — using all-false defaults')
    }

    // Sign our own JWT that embeds the resolved permissions
    const payload = {
      externalToken: data.token,
      email,
      permissions,
    }

    if (user) {
      payload.userId = user._id
      payload.role = user.role
    }

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
    console.log('[auth] step 5 - token signed, true count in payload:', countTrues(permissions))
    return res.status(200).json({ token })
  } catch (err) {
    console.error('[auth/login] fetch error:', err?.cause ?? err)
    return res.status(502).json({ message: 'Could not reach authentication server.', detail: err?.message })
  }
})

function countTrues(obj) {
  let count = 0
  for (const key of Object.keys(obj || {})) {
    if (obj[key] === true) count++
    else if (typeof obj[key] === 'object' && obj[key] !== null) count += countTrues(obj[key])
  }
  return count
}

// ONE-TIME bootstrap: creates an admin role (all true) and assigns it to the given email.
// POST /api/seed  { "email": "you@example.com" }
// Remove or comment out after first use.
router.post('/seed', async (req, res) => {
  try {
    const seedEmail = (req.body.email || '').toLowerCase()
    if (!seedEmail) return res.status(400).json({ message: 'email required' })

    const allTrue = buildDefaultPermissions(true)
    const role = await Role.findOneAndUpdate(
      { name: 'admin' },
      { name: 'admin', description: 'Full access', permissions: allTrue },
      { upsert: true, new: true },
    )

    const user = await User.findOneAndUpdate(
      { email: seedEmail },
      { email: seedEmail, role: 'admin', permissionOverrides: {} },
      { upsert: true, new: true },
    )

    return res.json({ message: 'Seeded', role: role.name, user: user.email })
  } catch (err) {
    console.error('[seed] error:', err)
    return res.status(500).json({ message: err.message })
  }
})

module.exports = router
