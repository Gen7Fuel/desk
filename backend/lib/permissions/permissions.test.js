const {
  buildDefaultPermissions,
  resolvePermissions,
  checkPermission,
  validateAgainstManifest,
} = require('./index')
const manifest = require('./manifest.json')

// ── buildDefaultPermissions ────────────────────────────────────────────────

describe('buildDefaultPermissions', () => {
  it('sets all actions to false when value=false', () => {
    const perms = buildDefaultPermissions(false)
    const values = collectLeaves(perms)
    expect(values.length).toBeGreaterThan(0)
    expect(values.every((v) => v === false)).toBe(true)
  })

  it('sets all actions to true when value=true', () => {
    const perms = buildDefaultPermissions(true)
    const values = collectLeaves(perms)
    expect(values.every((v) => v === true)).toBe(true)
  })

  it('covers all manifest modules', () => {
    const perms = buildDefaultPermissions(false)
    for (const mod of Object.keys(manifest.modules)) {
      expect(perms).toHaveProperty(mod)
    }
  })
})

// ── resolvePermissions ─────────────────────────────────────────────────────

describe('resolvePermissions', () => {
  it('returns role permissions unchanged when no overrides', () => {
    const rolePerms = buildDefaultPermissions(false)
    const resolved = resolvePermissions(rolePerms, {})
    expect(resolved).toEqual(rolePerms)
  })

  it('applies top-level override', () => {
    const rolePerms = buildDefaultPermissions(false)
    const resolved = resolvePermissions(rolePerms, {
      admin: { personnel: { create: true, read: true, update: false, delete: false } },
    })
    expect(resolved.admin.personnel.create).toBe(true)
    expect(resolved.admin.personnel.read).toBe(true)
    expect(resolved.admin.personnel.update).toBe(false)
  })

  it('applies nested override', () => {
    const rolePerms = buildDefaultPermissions(false)
    const resolved = resolvePermissions(rolePerms, {
      admin: { assets: { devices: { read: true } } },
    })
    expect(resolved.admin.assets.devices.read).toBe(true)
    expect(resolved.admin.assets.devices.create).toBe(false)
  })

  it('does not mutate the original rolePerms', () => {
    const rolePerms = buildDefaultPermissions(false)
    resolvePermissions(rolePerms, { admin: { personnel: { read: true } } })
    expect(rolePerms.admin.personnel.read).toBe(false)
  })
})

// ── checkPermission ────────────────────────────────────────────────────────

describe('checkPermission', () => {
  it('returns true for an allowed action', () => {
    const perms = buildDefaultPermissions(true)
    expect(checkPermission(perms, 'admin.personnel', 'read')).toBe(true)
  })

  it('returns false for a denied action', () => {
    const perms = buildDefaultPermissions(false)
    expect(checkPermission(perms, 'admin.personnel', 'read')).toBe(false)
  })

  it('resolves nested paths', () => {
    const perms = buildDefaultPermissions(false)
    perms.admin.assets.devices.read = true
    expect(checkPermission(perms, 'admin.assets.devices', 'read')).toBe(true)
    expect(checkPermission(perms, 'admin.assets.devices', 'create')).toBe(false)
  })

  it('returns false for unknown module', () => {
    const perms = buildDefaultPermissions(false)
    expect(checkPermission(perms, 'nonExistent', 'read')).toBe(false)
  })

  it('returns false when perms is empty object', () => {
    expect(checkPermission({}, 'personnel', 'read')).toBe(false)
  })
})

// ── validateAgainstManifest ────────────────────────────────────────────────

describe('validateAgainstManifest', () => {
  it('returns empty array for valid permissions', () => {
    const perms = buildDefaultPermissions(true)
    expect(validateAgainstManifest(perms)).toEqual([])
  })

  it('returns invalid module name', () => {
    const errors = validateAgainstManifest({ nonExistent: { read: true } })
    expect(errors).toContain('nonExistent')
  })

  it('returns invalid action for a submodule', () => {
    const errors = validateAgainstManifest({
      admin: { assets: { devices: { fly: true } } },
    })
    expect(errors.some((e) => e.includes('admin.assets.devices.fly'))).toBe(true)
  })

  it('returns empty array for empty object', () => {
    expect(validateAgainstManifest({})).toEqual([])
  })
})

// ── helper ─────────────────────────────────────────────────────────────────

function collectLeaves(obj) {
  const out = []
  for (const val of Object.values(obj)) {
    if (typeof val === 'boolean') out.push(val)
    else if (typeof val === 'object' && val !== null) out.push(...collectLeaves(val))
  }
  return out
}
