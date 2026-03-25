const manifest = require('./manifest.json')

/**
 * Build a default permission object from the manifest with all actions set to `value`.
 * @param {boolean} value – true for full access, false for no access
 * @returns {object}
 */
function buildNodePerms(def, value) {
  const perms = {}
  if (def.actions) {
    for (const action of def.actions) perms[action] = value
  }
  if (def.submodules) {
    for (const [sub, subDef] of Object.entries(def.submodules)) {
      perms[sub] = buildNodePerms(subDef, value)
    }
  }
  return perms
}

function buildDefaultPermissions(value = false) {
  const perms = {}
  for (const [mod, def] of Object.entries(manifest.modules)) {
    perms[mod] = buildNodePerms(def, value)
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
function deepMerge(target, source) {
  const result = JSON.parse(JSON.stringify(target))
  for (const [key, val] of Object.entries(source)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      if (!result[key] || typeof result[key] !== 'object') result[key] = {}
      result[key] = deepMerge(result[key], val)
    } else {
      result[key] = val
    }
  }
  return result
}

function resolvePermissions(rolePerms, overrides = {}) {
  console.log('[resolvePermissions] rolePerms fuelInvoicing:', JSON.stringify(rolePerms?.fuelInvoicing))
  console.log('[resolvePermissions] overrides keys:', Object.keys(overrides))
  return deepMerge(JSON.parse(JSON.stringify(rolePerms)), overrides)
}

/**
 * Validate that a permission object only contains keys present in the manifest.
 * Returns an array of invalid paths (empty = valid).
 * @param {object} perms – permission object to validate
 * @returns {string[]} invalid paths
 */
function validateNode(def, val, path, errors) {
  if (typeof val !== 'object' || val === null) return
  for (const [key, keyVal] of Object.entries(val)) {
    if (def.actions && def.actions.includes(key)) continue
    if (def.submodules && def.submodules[key]) {
      validateNode(def.submodules[key], keyVal, `${path}.${key}`, errors)
      continue
    }
    errors.push(`${path}.${key}`)
  }
}

function validateAgainstManifest(perms) {
  const errors = []
  for (const [mod, val] of Object.entries(perms)) {
    const modDef = manifest.modules[mod]
    if (!modDef) {
      errors.push(mod)
      continue
    }
    validateNode(modDef, val, mod, errors)
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
