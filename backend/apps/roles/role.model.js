const mongoose = require('mongoose')
const { buildDefaultPermissions } = require('../../lib/permissions')

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  permissions: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true })

/**
 * Pre-validate: fill any missing permission keys with false
 * so every role always has the full manifest shape.
 */
RoleSchema.pre('validate', function () {
  const defaults = buildDefaultPermissions(false)
  const merged = deepFill(defaults, this.permissions || {})
  this.permissions = merged
})

/** Recursively fill missing keys from `defaults` into `target`. */
function deepFill(defaults, target) {
  const result = {}
  for (const [key, val] of Object.entries(defaults)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      result[key] = deepFill(val, target[key] || {})
    } else {
      result[key] = target[key] !== undefined ? target[key] : val
    }
  }
  return result
}

module.exports = mongoose.model('Role', RoleSchema)
