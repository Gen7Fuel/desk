const jwt = require('jsonwebtoken')
const { checkPermission } = require('../lib/permissions')

const JWT_SECRET = process.env.JWT_SECRET || 'desk-dev-secret'

/**
 * Middleware: verify the JWT and attach decoded payload to req.user
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' })
  }

  try {
    const token = header.split(' ')[1]
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

/**
 * Middleware factory: require a specific permission.
 * @param {string} modulePath – dot-separated path, e.g. "assets.devices"
 * @param {string} action – "create" | "read" | "update" | "delete"
 *
 * Usage:  router.delete('/:id', authenticate, requirePermission('assets.devices', 'delete'), handler)
 */
function requirePermission(modulePath, action) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({ message: 'Forbidden.' })
    }
    if (!checkPermission(req.user.permissions, modulePath, action)) {
      return res.status(403).json({ message: `Forbidden: ${modulePath}.${action}` })
    }
    next()
  }
}

module.exports = { authenticate, requirePermission }
