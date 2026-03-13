const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const Category = require('./category.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', require('./category.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

describe('GET /api/subscriptions/categories', () => {
  it('returns all categories', async () => {
    vi.spyOn(Category, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue([{ _id: 'c1', name: 'Cloud' }]) })
    const res = await request(makeApp()).get('/api/subscriptions/categories').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('POST /api/subscriptions/categories', () => {
  it('returns 400 when name is blank', async () => {
    const res = await request(makeApp()).post('/api/subscriptions/categories').set('Authorization', AUTH).send({ name: '  ' })
    expect(res.status).toBe(400)
  })

  it('creates and returns the category', async () => {
    vi.spyOn(Category, 'create').mockResolvedValue({ _id: 'c1', name: 'Cloud' })
    const res = await request(makeApp()).post('/api/subscriptions/categories').set('Authorization', AUTH).send({ name: 'Cloud' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Cloud')
  })

  it('returns 409 on duplicate name', async () => {
    const err = new Error('dup')
    err.code = 11000
    vi.spyOn(Category, 'create').mockRejectedValue(err)

    const res = await request(makeApp()).post('/api/subscriptions/categories').set('Authorization', AUTH).send({ name: 'Cloud' })
    expect(res.status).toBe(409)
  })
})

describe('DELETE /api/subscriptions/categories/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Category, 'findByIdAndDelete').mockResolvedValue(null)
    const res = await request(makeApp()).delete('/api/subscriptions/categories/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('deletes successfully', async () => {
    vi.spyOn(Category, 'findByIdAndDelete').mockResolvedValue({ _id: 'c1' })
    const res = await request(makeApp()).delete('/api/subscriptions/categories/c1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
