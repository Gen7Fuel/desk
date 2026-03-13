const request = require('supertest')
const express = require('express')
const User = require('../users/user.model')
const Role = require('../roles/role.model')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', require('./auth.routes'))
  return app
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ── POST /auth/login ───────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns 401 when external auth fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({ message: 'Invalid credentials' })),
      })
    )

    const res = await request(makeApp()).post('/api/auth/login').send({ email: 'x@x.com', password: 'bad' })

    expect(res.status).toBe(401)
  })

  it('returns 200 with a JWT when external auth succeeds (no role)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ token: 'ext-token-123' })),
      })
    )

    vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue({
      _id: 'uid1',
      email: 'test@gen7fuel.com',
      role: null,
      permissionOverrides: {},
      toObject() { return { _id: 'uid1', email: 'test@gen7fuel.com', role: null, permissionOverrides: {} } },
    })

    const res = await request(makeApp()).post('/api/auth/login').send({ email: 'test@gen7fuel.com', password: 'pw' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
  })

  it('returns 200 with resolved permissions when user has a role', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ token: 'ext-token-abc' })),
      })
    )

    vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue({
      _id: 'uid1',
      email: 'admin@gen7fuel.com',
      role: 'Admin',
      permissionOverrides: {},
      toObject() {
        return { _id: 'uid1', email: 'admin@gen7fuel.com', role: 'Admin', permissionOverrides: {} }
      },
    })

    const { buildDefaultPermissions } = require('../../lib/permissions')
    const adminPerms = buildDefaultPermissions(true)

    vi.spyOn(Role, 'findOne').mockResolvedValue({
      toObject() { return { name: 'Admin', permissions: adminPerms } },
    })

    const res = await request(makeApp()).post('/api/auth/login').send({ email: 'admin@gen7fuel.com', password: 'pw' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
  })
})
