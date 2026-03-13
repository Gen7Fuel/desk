const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const Category = require('./credentialCategory.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', require('./credentialCategory.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

describe('GET /api/credentials/categories', () => {
  it('returns all categories', async () => {
    vi.spyOn(Category, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue([{ _id: 'cat1', name: 'DevOps' }]) })
    const res = await request(makeApp()).get('/api/credentials/categories').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /api/credentials/categories/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Category, 'findById').mockResolvedValue(null)
    const res = await request(makeApp()).get('/api/credentials/categories/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns the category', async () => {
    vi.spyOn(Category, 'findById').mockResolvedValue({ _id: 'cat1', name: 'DevOps' })
    const res = await request(makeApp()).get('/api/credentials/categories/cat1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('DevOps')
  })
})

describe('POST /api/credentials/categories', () => {
  it('returns 400 when name is missing or blank', async () => {
    const res = await request(makeApp()).post('/api/credentials/categories').set('Authorization', AUTH).send({ name: '' })
    expect(res.status).toBe(400)
  })

  it('creates and returns the category', async () => {
    vi.spyOn(Category, 'create').mockResolvedValue({ _id: 'cat1', name: 'DevOps' })
    const res = await request(makeApp()).post('/api/credentials/categories').set('Authorization', AUTH).send({ name: 'DevOps' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('DevOps')
  })

  it('returns 409 on duplicate name', async () => {
    const err = new Error('dup')
    err.code = 11000
    vi.spyOn(Category, 'create').mockRejectedValue(err)
    const res = await request(makeApp()).post('/api/credentials/categories').set('Authorization', AUTH).send({ name: 'DevOps' })
    expect(res.status).toBe(409)
  })
})

describe('PUT /api/credentials/categories/:id', () => {
  it('returns 400 when name is blank', async () => {
    const res = await request(makeApp()).put('/api/credentials/categories/cat1').set('Authorization', AUTH).send({ name: ' ' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when not found', async () => {
    vi.spyOn(Category, 'findByIdAndUpdate').mockResolvedValue(null)
    const res = await request(makeApp()).put('/api/credentials/categories/507f1f77bcf86cd799439011').set('Authorization', AUTH).send({ name: 'New' })
    expect(res.status).toBe(404)
  })

  it('returns updated category', async () => {
    vi.spyOn(Category, 'findByIdAndUpdate').mockResolvedValue({ _id: 'cat1', name: 'Updated' })
    const res = await request(makeApp()).put('/api/credentials/categories/cat1').set('Authorization', AUTH).send({ name: 'Updated' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated')
  })
})

describe('DELETE /api/credentials/categories/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Category, 'findByIdAndDelete').mockResolvedValue(null)
    const res = await request(makeApp()).delete('/api/credentials/categories/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('deletes successfully', async () => {
    vi.spyOn(Category, 'findByIdAndDelete').mockResolvedValue({ _id: 'cat1' })
    const res = await request(makeApp()).delete('/api/credentials/categories/cat1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
