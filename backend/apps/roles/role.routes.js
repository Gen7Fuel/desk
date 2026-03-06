const express = require('express')
const router = express.Router()
const Role = require('./role.model')
const manifest = require('../../lib/permissions/manifest.json')
const { validateAgainstManifest, buildDefaultPermissions } = require('../../lib/permissions')
const { authenticate, requirePermission } = require('../../middleware/auth')

// GET /roles — list all roles
router.get('/', authenticate, requirePermission('settings.roles', 'read'), async (_req, res) => {
  try {
    const roles = await Role.find().sort({ name: 1 })
    return res.json(roles)
  } catch (err) {
    console.error('[roles] list error:', err)
    return res.status(500).json({ message: 'Failed to list roles.' })
  }
})

// GET /roles/manifest — return the permission manifest for UI rendering
router.get('/manifest', authenticate, (_req, res) => {
  return res.json(manifest)
})

// GET /roles/:id — get a single role
router.get('/:id', authenticate, requirePermission('settings.roles', 'read'), async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
    if (!role) return res.status(404).json({ message: 'Role not found.' })
    return res.json(role)
  } catch (err) {
    console.error('[roles] get error:', err)
    return res.status(500).json({ message: 'Failed to get role.' })
  }
})

// POST /roles — create a new role
router.post('/', authenticate, requirePermission('settings.roles', 'create'), async (req, res) => {
  try {
    const { name, description, permissions } = req.body
    if (!name) return res.status(400).json({ message: 'Role name is required.' })

    const invalid = validateAgainstManifest(permissions || {})
    if (invalid.length) {
      return res.status(400).json({ message: 'Invalid permission paths.', paths: invalid })
    }

    const role = await Role.create({ name, description, permissions: permissions || buildDefaultPermissions(false) })
    return res.status(201).json(role)
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A role with this name already exists.' })
    }
    console.error('[roles] create error:', err)
    return res.status(500).json({ message: 'Failed to create role.' })
  }
})

// PUT /roles/:id — update a role
router.put('/:id', authenticate, requirePermission('settings.roles', 'update'), async (req, res) => {
  try {
    const { name, description, permissions } = req.body

    if (permissions) {
      const invalid = validateAgainstManifest(permissions)
      if (invalid.length) {
        return res.status(400).json({ message: 'Invalid permission paths.', paths: invalid })
      }
    }

    const role = await Role.findById(req.params.id)
    if (!role) return res.status(404).json({ message: 'Role not found.' })

    if (name !== undefined) role.name = name
    if (description !== undefined) role.description = description
    if (permissions !== undefined) {
      role.permissions = permissions
      role.markModified('permissions') // Required for Mongoose Mixed fields
    }

    await role.save() // triggers pre-validate to fill missing keys
    return res.json(role)
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A role with this name already exists.' })
    }
    console.error('[roles] update error:', err)
    return res.status(500).json({ message: 'Failed to update role.' })
  }
})

// DELETE /roles/:id — delete a role
router.delete('/:id', authenticate, requirePermission('settings.roles', 'delete'), async (req, res) => {
  try {
    const role = await Role.findByIdAndDelete(req.params.id)
    if (!role) return res.status(404).json({ message: 'Role not found.' })
    return res.json({ message: 'Role deleted.' })
  } catch (err) {
    console.error('[roles] delete error:', err)
    return res.status(500).json({ message: 'Failed to delete role.' })
  }
})

module.exports = router
