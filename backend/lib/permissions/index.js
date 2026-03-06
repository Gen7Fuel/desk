const manifest = require('./manifest.json')

/**
 * Build a default permission object from the manifest with all actions set to `value`.
 * @param {boolean} value – true for full access, false for no access
 * @returns {object}
 */
function buildDefaultPermissions(value = false) {
  const perms = {}
  for (const [mod, def] of Object.entries(manifest.modules)) {
    if (def.actions) {
      perms[mod] = {}
      for (const action of def.actions) perms[mod][action] = value
    }
    if (def.submodules) {
      perms[mod] = {}
      for (const [sub, subDef] of Object.entries(def.submodules)) {
        perms[mod][sub] = {}
        for (const action of subDef.actions) perms[mod][sub][action] = value
      }
    }
  }
  return perms
}

/**
 * Deep-merge role permissions with user overrides.
 * User overrides win on any explicitly-set boolean key.
 * @param {object} rolePerms – the role's full permission object
 * @param {object} overrides – sparse override object from the user
 * @returns {object} resolved permissions
 */
function resolvePermissions(rolePerms, overrides = {}) {
  const result = JSON.parse(JSON.stringify(rolePerms)) // deep clone
  console.log('[resolvePermissions] rolePerms fuelInvoicing:', JSON.stringify(rolePerms?.fuelInvoicing))
  console.log('[resolvePermissions] overrides keys:', Object.keys(overrides))
  for (const [key, val] of Object.entries(overrides)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      if (!result[key]) result[key] = {}
      for (const [subKey, subVal] of Object.entries(val)) {
        if (typeof subVal === 'object' && subVal !== null && !Array.isArray(subVal)) {
          if (!result[key][subKey]) result[key][subKey] = {}
          Object.assign(result[key][subKey], subVal)
        } else {
          result[key][subKey] = subVal
        }
      }
    } else {
      result[key] = val
    }
  }
  return result
}

/**
 * Validate that a permission object only contains keys present in the manifest.
 * Returns an array of invalid paths (empty = valid).
 * @param {object} perms – permission object to validate
 * @returns {string[]} invalid paths
 */
function validateAgainstManifest(perms) {
  const errors = []
  for (const [mod, val] of Object.entries(perms)) {
    const modDef = manifest.modules[mod]
    if (!modDef) {
      errors.push(mod)
      continue
    }
    if (typeof val !== 'object' || val === null) continue

    for (const [key, keyVal] of Object.entries(val)) {
      // leaf module (has actions directly)
      if (modDef.actions && modDef.actions.includes(key)) continue
      // parent module (has submodules)
      if (modDef.submodules && modDef.submodules[key]) {
        if (typeof keyVal === 'object' && keyVal !== null) {
          for (const action of Object.keys(keyVal)) {
            if (!modDef.submodules[key].actions.includes(action)) {
              errors.push(`${mod}.${key}.${action}`)
            }
          }
        }
        continue
      }
      errors.push(`${mod}.${key}`)
    }
  }
  return errors
}

/**
 * Check a resolved permission object for a specific module path + action.
 * @param {object} perms – resolved permissions
 * @param {string} path – dot-separated module path, e.g. "assets.devices"
 * @param {string} action – "create" | "read" | "update" | "delete"
 * @returns {boolean}
 */
function checkPermission(perms, path, action) {
  const parts = path.split('.')
  let node = perms
  for (const p of parts) {
    if (!node || typeof node !== 'object') return false
    node = node[p]
  }
  if (!node || typeof node !== 'object') return false
  return node[action] === true
}

module.exports = {
  buildDefaultPermissions,
  resolvePermissions,
  validateAgainstManifest,
  checkPermission,
}
