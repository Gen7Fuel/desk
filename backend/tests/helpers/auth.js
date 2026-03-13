const jwt = require('jsonwebtoken')

const JWT_SECRET = 'desk-dev-secret'

/**
 * Generate a valid JWT for use in route tests.
 * All permissions default to true so requirePermission always passes
 * (the middleware is also mocked in route tests, but this is useful
 * for auth middleware unit tests).
 */
function makeToken(overrides = {}) {
  return jwt.sign(
    {
      userId: '000000000000000000000001',
      email: 'test@gen7fuel.com',
      role: 'admin',
      permissions: overrides.permissions ?? {},
      ...overrides,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  )
}

/**
 * Return an Authorization header value.
 */
function authHeader(overrides = {}) {
  return `Bearer ${makeToken(overrides)}`
}

module.exports = { makeToken, authHeader, JWT_SECRET }
