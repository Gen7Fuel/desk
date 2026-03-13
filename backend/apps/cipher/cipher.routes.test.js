const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const Cipher = require('./cipher.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', require('./cipher.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

describe('POST /api/encrypt', () => {
  it('returns 400 when text is missing', async () => {
    const res = await request(makeApp()).post('/api/encrypt').set('Authorization', AUTH).send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/missing text/i)
  })

  it('encrypts text and returns id and key', async () => {
    vi.spyOn(Cipher, 'create').mockResolvedValue({ _id: 'doc1' })

    const res = await request(makeApp()).post('/api/encrypt').set('Authorization', AUTH).send({ text: 'hello' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id', 'doc1')
    expect(res.body).toHaveProperty('key')
    expect(Cipher.create).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/decrypt', () => {
  it('returns 400 when id or key is missing', async () => {
    const res = await request(makeApp()).post('/api/decrypt').set('Authorization', AUTH).send({ id: 'x' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when cipher doc not found', async () => {
    vi.spyOn(Cipher, 'findById').mockResolvedValue(null)

    const res = await request(makeApp())
      .post('/api/decrypt')
      .set('Authorization', AUTH)
      .send({ id: '507f1f77bcf86cd799439011', key: 'aabbcc' })

    expect(res.status).toBe(404)
  })

  it('decrypts and returns the original text', async () => {
    const { encrypt } = require('../../utils/crypto')
    const { encrypted, key, iv, tag } = encrypt('secret message')
    vi.spyOn(Cipher, 'findById').mockResolvedValue({ encrypted, iv, tag })

    const res = await request(makeApp())
      .post('/api/decrypt')
      .set('Authorization', AUTH)
      .send({ id: '507f1f77bcf86cd799439011', key })

    expect(res.status).toBe(200)
    expect(res.body.text).toBe('secret message')
  })

  it('returns 401 when key is wrong', async () => {
    const { encrypt } = require('../../utils/crypto')
    const { encrypted, iv, tag } = encrypt('secret message')
    vi.spyOn(Cipher, 'findById').mockResolvedValue({ encrypted, iv, tag })

    const res = await request(makeApp())
      .post('/api/decrypt')
      .set('Authorization', AUTH)
      .send({ id: '507f1f77bcf86cd799439011', key: '0'.repeat(64) })

    expect(res.status).toBe(401)
  })
})
