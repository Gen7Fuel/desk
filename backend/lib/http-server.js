const { createServer } = require('node:http')

// Desk JWTs contain a Hub token and resolved permissions. Apply the same bounded
// budget for every entry point, including Docker's direct node invocation.
function createApiServer(app) {
  return createServer({ maxHeaderSize: 64 * 1024 }, app)
}

module.exports = { createApiServer }
