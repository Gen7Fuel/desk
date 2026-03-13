const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const Credential = require('./credential.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', require('./credential.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

const VALID_BODY = { name: 'GitHub', category: 'DevOps', username: 'admin', password: 'secret123' }

describe('POST /api/credentials', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(makeApp()).post('/api/credentials').set('Authorization', AUTH).send({ name: 'x' })
    expect(res.status).toBe(400)
  })

  it('creates and returns the credential', async () => {
    vi.spyOn(Credential, 'create').mockResolvedValue({ _id: 'cr1', ...VALID_BODY })
    const res = await request(makeApp()).post('/api/credentials').set('Authorization', AUTH).send(VALID_BODY)
    expect(res.status).toBe(201)
    expect(res.body._id).toBe('cr1')
  })
})

describe('GET /api/credentials', () => {
  it('returns list of credentials', async () => {
    vi.spyOn(Credential, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue([{ _id: 'cr1' }]) })
    const res = await request(makeApp()).get('/api/credentials').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /api/credentials/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Credential, 'findById').mockResolvedValue(null)
    const res = await request(makeApp()).get('/api/credentials/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns the credential', async () => {
    vi.spyOn(Credential, 'findById').mockResolvedValue({ _id: 'cr1', ...VALID_BODY })
    const res = await request(makeApp()).get('/api/credentials/cr1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body._id).toBe('cr1')
  })
})

describe('PUT /api/credentials/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Credential, 'findByIdAndUpdate').mockResolvedValue(null)
    const res = await request(makeApp()).put('/api/credentials/507f1f77bcf86cd799439011').set('Authorization', AUTH).send(VALID_BODY)
    expect(res.status).toBe(404)
  })

  it('returns updated credential', async () => {
    const updated = { _id: 'cr1', ...VALID_BODY, username: 'newadmin' }
    vi.spyOn(Credential, 'findByIdAndUpdate').mockResolvedValue(updated)
    const res = await request(makeApp()).put('/api/credentials/cr1').set('Authorization', AUTH).send({ ...VALID_BODY, username: 'newadmin' })
    expect(res.status).toBe(200)
    expect(res.body.username).toBe('newadmin')
  })
})

describe('DELETE /api/credentials/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Credential, 'findByIdAndDelete').mockResolvedValue(null)
    const res = await request(makeApp()).delete('/api/credentials/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('deletes successfully', async () => {
    vi.spyOn(Credential, 'findByIdAndDelete').mockResolvedValue({ _id: 'cr1' })
    const res = await request(makeApp()).delete('/api/credentials/cr1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
