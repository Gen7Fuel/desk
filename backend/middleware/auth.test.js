const { makeToken, JWT_SECRET } = require('../tests/helpers/auth')
const jwt = require('jsonwebtoken')

// We import the real middleware (not mocked) for unit tests
const { authenticate, requirePermission } = require('./auth')

// ── helpers ────────────────────────────────────────────────────────────────

function makeReq(headers = {}) {
  return { headers }
}

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this },
    json(body) { this._body = body; return this },
  }
  return res
}

// ── authenticate ───────────────────────────────────────────────────────────

describe('authenticate', () => {
  it('calls next() and attaches req.user for a valid token', () => {
    const token = makeToken()
    const req = makeReq({ authorization: `Bearer ${token}` })
    const res = makeRes()
    let called = false

    authenticate(req, res, () => { called = true })

    expect(called).toBe(true)
    expect(req.user).toBeDefined()
    expect(req.user.email).toBe('test@gen7fuel.com')
  })

  it('returns 401 when no Authorization header', () => {
    const req = makeReq({})
    const res = makeRes()

    authenticate(req, res, () => {})

    expect(res._status).toBe(401)
    expect(res._body.message).toMatch(/no token/i)
  })

  it('returns 401 for a malformed header (missing Bearer prefix)', () => {
    const req = makeReq({ authorization: 'Token abc123' })
    const res = makeRes()

    authenticate(req, res, () => {})

    expect(res._status).toBe(401)
  })

  it('returns 401 for an expired token', () => {
    const token = jwt.sign({ email: 'x@x.com' }, JWT_SECRET, { expiresIn: -1 })
    const req = makeReq({ authorization: `Bearer ${token}` })
    const res = makeRes()

    authenticate(req, res, () => {})

    expect(res._status).toBe(401)
    expect(res._body.message).toMatch(/invalid|expired/i)
  })

  it('returns 401 for a token signed with a different secret', () => {
    const token = jwt.sign({ email: 'x@x.com' }, 'wrong-secret', { expiresIn: '1h' })
    const req = makeReq({ authorization: `Bearer ${token}` })
    const res = makeRes()

    authenticate(req, res, () => {})

    expect(res._status).toBe(401)
  })
})

// ── requirePermission ──────────────────────────────────────────────────────

describe('requirePermission', () => {
  function makeReqWithUser(permissions = {}) {
    return { user: { email: 'test@test.com', permissions } }
  }

  it('calls next() when permission is true', () => {
    const req = makeReqWithUser({ personnel: { read: true } })
    const res = makeRes()
    let called = false

    requirePermission('personnel', 'read')(req, res, () => { called = true })

    expect(called).toBe(true)
  })

  it('returns 403 when permission is false', () => {
    const req = makeReqWithUser({ personnel: { read: false } })
    const res = makeRes()

    requirePermission('personnel', 'read')(req, res, () => {})

    expect(res._status).toBe(403)
    expect(res._body.message).toMatch(/forbidden/i)
  })

  it('returns 403 when req.user is not set', () => {
    const req = { user: null }
    const res = makeRes()

    requirePermission('personnel', 'read')(req, res, () => {})

    expect(res._status).toBe(403)
  })

  it('returns 403 for nested permission path when false', () => {
    const req = makeReqWithUser({ assets: { devices: { read: false } } })
    const res = makeRes()

    requirePermission('assets.devices', 'read')(req, res, () => {})

    expect(res._status).toBe(403)
  })

  it('calls next() for nested permission path when true', () => {
    const req = makeReqWithUser({ assets: { devices: { read: true } } })
    const res = makeRes()
    let called = false

    requirePermission('assets.devices', 'read')(req, res, () => { called = true })

    expect(called).toBe(true)
  })
})
