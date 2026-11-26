const crypto = require('node:crypto')
const { setTimeout: sleep } = require('node:timers/promises')

const RANGE_BYTES = 8 * 1024 * 1024
const ATTEMPTS = 4
function transient(error) {
  return error.name === 'AbortError' ||
    ['ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPIPE', 'ENETUNREACH',
      'REQUEST_SEND_ERROR', 'ERR_STREAM_PREMATURE_CLOSE', 'BACKUP_SHORT_RANGE'].includes(error.code) ||
    [408, 429].includes(error.statusCode) || error.statusCode >= 500
}

// Hash every uploaded byte in order. Discard a failed range before retrying,
// so partial downloads cannot enter the digest twice or mix blob versions.
async function verifyArchive(target, { size, etag, sha256, check }, options = {}) {
  const rangeBytes = options.rangeBytes ?? RANGE_BYTES
  const delay = options.delay || sleep
  if (!Number.isSafeInteger(size) || size < 0 || !etag || !/^[a-f0-9]{64}$/.test(sha256) ||
      !Number.isSafeInteger(rangeBytes) || rangeBytes < 1 || rangeBytes > RANGE_BYTES) {
    throw new Error('Invalid archive verification inputs')
  }
  const hash = crypto.createHash('sha256')
  for (let offset = 0; offset < size; offset += rangeBytes) {
    const count = Math.min(rangeBytes, size - offset)
    let body
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      check()
      try {
        body = await target.downloadToBuffer(offset, count, {
          conditions: { ifMatch: etag }, maxRetryRequests: 0,
        })
        check()
        if (body.length !== count) throw Object.assign(new Error('Incomplete archive range'), { code: 'BACKUP_SHORT_RANGE' })
        break
      } catch (error) {
        check()
        if (!transient(error) || attempt === ATTEMPTS - 1) throw error
        await delay([250, 1000, 2000][attempt])
      }
    }
    check()
    hash.update(body)
  }
  check()
  if (hash.digest('hex') !== sha256) throw new Error('Uploaded backup verification failed')
}

module.exports = { verifyArchive }
