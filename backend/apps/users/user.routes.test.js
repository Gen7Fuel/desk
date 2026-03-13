const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const User = require('./user.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/users', require('./user.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

const USER_DOC = {
  _id: 'u1',
  email: 'alice@gen7fuel.com',
  role: 'Viewer',
  permissionOverrides: {},
}

describe('GET /users', () => {
  it('returns all users', async () => {
    vi.spyOn(User, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue([USER_DOC]) })
    const res = await request(makeApp()).get('/users').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /users/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue(null)
    const res = await request(makeApp()).get('/users/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns the user', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue(USER_DOC)
    const res = await request(makeApp()).get('/users/u1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.email).toBe('alice@gen7fuel.com')
  })
})

describe('POST /users', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(makeApp()).post('/users').set('Authorization', AUTH).send({ role: 'Viewer' })
    expect(res.status).toBe(400)
  })

  it('creates and returns the user', async () => {
    vi.spyOn(User, 'create').mockResolvedValue(USER_DOC)
    const res = await request(makeApp()).post('/users').set('Authorization', AUTH).send({ email: 'alice@gen7fuel.com', role: 'Viewer' })
    expect(res.status).toBe(201)
    expect(res.body.email).toBe('alice@gen7fuel.com')
  })

  it('returns 400 for invalid permission override paths', async () => {
    const res = await request(makeApp())
      .post('/users')
      .set('Authorization', AUTH)
      .send({ email: 'alice@gen7fuel.com', permissionOverrides: { notReal: { read: true } } })
    expect(res.status).toBe(400)
    expect(res.body.paths).toBeDefined()
  })

  it('returns 409 on duplicate email', async () => {
    const err = new Error('dup')
    err.code = 11000
    vi.spyOn(User, 'create').mockRejectedValue(err)
    const res = await request(makeApp()).post('/users').set('Authorization', AUTH).send({ email: 'alice@gen7fuel.com' })
    expect(res.status).toBe(409)
  })
})

describe('PUT /users/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue(null)
    const res = await request(makeApp()).put('/users/507f1f77bcf86cd799439011').set('Authorization', AUTH).send({ role: 'Admin' })
    expect(res.status).toBe(404)
  })

  it('updates and saves the user', async () => {
    const mockUser = {
      ...USER_DOC,
      save: vi.fn().mockResolvedValue(USER_DOC),
      markModified: vi.fn(),
    }
    vi.spyOn(User, 'findById').mockResolvedValue(mockUser)

    const res = await request(makeApp()).put('/users/u1').set('Authorization', AUTH).send({ role: 'Admin' })

    expect(res.status).toBe(200)
    expect(mockUser.save).toHaveBeenCalledTimes(1)
  })
})

describe('DELETE /users/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(User, 'findByIdAndDelete').mockResolvedValue(null)
    const res = await request(makeApp()).delete('/users/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('deletes successfully', async () => {
    vi.spyOn(User, 'findByIdAndDelete').mockResolvedValue(USER_DOC)
    const res = await request(makeApp()).delete('/users/u1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted/i)
  })
})
