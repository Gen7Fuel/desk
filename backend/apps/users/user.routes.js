const express = require('express')
const router = express.Router()
const User = require('./user.model')
const { validateAgainstManifest } = require('../../lib/permissions')
const { authenticate, requirePermission } = require('../../middleware/auth')

// GET /users
router.get('/', authenticate, requirePermission('settings.users', 'read'), async (_req, res) => {
  try {
    const users = await User.find().sort({ email: 1 })
    return res.json(users)
  } catch (err) {
    console.error('[users] list error:', err)
    return res.status(500).json({ message: 'Failed to list users.' })
  }
})

// GET /users/:id
router.get('/:id', authenticate, requirePermission('settings.users', 'read'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found.' })
    return res.json(user)
  } catch (err) {
    console.error('[users] get error:', err)
    return res.status(500).json({ message: 'Failed to get user.' })
  }
})

// POST /users — create a user (admin pre-provisioning)
router.post('/', authenticate, requirePermission('settings.users', 'create'), async (req, res) => {
  try {
    const { email, role, permissionOverrides } = req.body
    if (!email) return res.status(400).json({ message: 'Email is required.' })

    if (permissionOverrides) {
      const invalid = validateAgainstManifest(permissionOverrides)
      if (invalid.length) {
        return res.status(400).json({ message: 'Invalid permission paths.', paths: invalid })
      }
    }

    const user = await User.create({ email, role, permissionOverrides })
    return res.status(201).json(user)
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A user with this email already exists.' })
    }
    console.error('[users] create error:', err)
    return res.status(500).json({ message: 'Failed to create user.' })
  }
})

// PUT /users/:id — update role and/or overrides
router.put('/:id', authenticate, requirePermission('settings.users', 'update'), async (req, res) => {
  try {
    const { role, permissionOverrides } = req.body

    if (permissionOverrides) {
      const invalid = validateAgainstManifest(permissionOverrides)
      if (invalid.length) {
        return res.status(400).json({ message: 'Invalid permission paths.', paths: invalid })
      }
    }

    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found.' })

    if (role !== undefined) user.role = role
    if (permissionOverrides !== undefined) {
      user.permissionOverrides = permissionOverrides
      user.markModified('permissionOverrides') // Required for Mongoose Mixed fields
    }

    await user.save()
    return res.json(user)
  } catch (err) {
    console.error('[users] update error:', err)
    return res.status(500).json({ message: 'Failed to update user.' })
  }
})

// DELETE /users/:id
router.delete('/:id', authenticate, requirePermission('settings.users', 'delete'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found.' })
    return res.json({ message: 'User deleted.' })
  } catch (err) {
    console.error('[users] delete error:', err)
    return res.status(500).json({ message: 'Failed to delete user.' })
  }
})

module.exports = router
