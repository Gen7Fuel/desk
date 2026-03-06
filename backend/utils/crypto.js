const crypto = require('crypto')

const algorithm = 'aes-256-gcm'
const ENCRYPTION_KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 12 // 96 bits for GCM

function generateKey() {
  return crypto.randomBytes(ENCRYPTION_KEY_LENGTH)
}

function encrypt(text) {
  const key = generateKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag()
  return {
    encrypted,
    key: key.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  }
}

function decrypt(encrypted, keyHex, ivHex, tagHex) {
  const key = Buffer.from(keyHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

module.exports = { encrypt, decrypt }