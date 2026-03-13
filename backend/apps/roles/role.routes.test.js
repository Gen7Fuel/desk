const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const Role = require('./role.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/roles', require('./role.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

const ROLE_DOC = {
  _id: 'r1',
  name: 'Viewer',
  description: 'Read-only access',
  permissions: buildDefaultPermissions(false),
}

describe('GET /roles', () => {
  it('returns all roles', async () => {
    vi.spyOn(Role, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue([ROLE_DOC]) })
    const res = await request(makeApp()).get('/roles').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /roles/manifest', () => {
  it('returns the permission manifest', async () => {
    const res = await request(makeApp()).get('/roles/manifest').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('modules')
  })
})

describe('GET /roles/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Role, 'findById').mockResolvedValue(null)
    const res = await request(makeApp()).get('/roles/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns the role', async () => {
    vi.spyOn(Role, 'findById').mockResolvedValue(ROLE_DOC)
    const res = await request(makeApp()).get('/roles/r1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Viewer')
  })
})

describe('POST /roles', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(makeApp()).post('/roles').set('Authorization', AUTH).send({ description: 'no name' })
    expect(res.status).toBe(400)
  })

  it('creates and returns the role', async () => {
    vi.spyOn(Role, 'create').mockResolvedValue({ _id: 'r1', name: 'Viewer', permissions: buildDefaultPermissions(false) })
    const res = await request(makeApp()).post('/roles').set('Authorization', AUTH).send({ name: 'Viewer' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Viewer')
  })

  it('returns 400 for invalid permission paths', async () => {
    const res = await request(makeApp())
      .post('/roles')
      .set('Authorization', AUTH)
      .send({ name: 'Bad', permissions: { notReal: { read: true } } })
    expect(res.status).toBe(400)
    expect(res.body.paths).toBeDefined()
  })

  it('returns 409 on duplicate name', async () => {
    const err = new Error('dup')
    err.code = 11000
    vi.spyOn(Role, 'create').mockRejectedValue(err)
    const res = await request(makeApp()).post('/roles').set('Authorization', AUTH).send({ name: 'Viewer' })
    expect(res.status).toBe(409)
  })
})

describe('PUT /roles/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Role, 'findById').mockResolvedValue(null)
    const res = await request(makeApp()).put('/roles/507f1f77bcf86cd799439011').set('Authorization', AUTH).send({ name: 'New' })
    expect(res.status).toBe(404)
  })

  it('updates and saves the role', async () => {
    const mockRole = {
      ...ROLE_DOC,
      save: vi.fn().mockResolvedValue(ROLE_DOC),
      markModified: vi.fn(),
    }
    vi.spyOn(Role, 'findById').mockResolvedValue(mockRole)

    const res = await request(makeApp()).put('/roles/r1').set('Authorization', AUTH).send({ name: 'Admin' })
    expect(res.status).toBe(200)
    expect(mockRole.save).toHaveBeenCalledTimes(1)
  })
})

describe('DELETE /roles/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Role, 'findByIdAndDelete').mockResolvedValue(null)
    const res = await request(makeApp()).delete('/roles/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('deletes successfully', async () => {
    vi.spyOn(Role, 'findByIdAndDelete').mockResolvedValue(ROLE_DOC)
    const res = await request(makeApp()).delete('/roles/r1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted/i)
  })
})
