const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const ResourceKind = require('./resourceKind.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/access/resource-kinds', require('./resourceKind.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

describe('GET /access/resource-kinds', () => {
  it('returns all resource kinds', async () => {
    vi.spyOn(ResourceKind, 'find').mockResolvedValue([{ _id: 'rk1', name: 'Vehicle' }])
    const res = await request(makeApp()).get('/access/resource-kinds').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('POST /access/resource-kinds', () => {
  it('creates and returns the kind', async () => {
    vi.spyOn(ResourceKind, 'create').mockResolvedValue({ _id: 'rk1', name: 'Vehicle' })
    const res = await request(makeApp()).post('/access/resource-kinds').set('Authorization', AUTH).send({ name: 'Vehicle' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Vehicle')
  })
})

describe('PUT /access/resource-kinds/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(ResourceKind, 'findByIdAndUpdate').mockResolvedValue(null)
    const res = await request(makeApp()).put('/access/resource-kinds/507f1f77bcf86cd799439011').set('Authorization', AUTH).send({ name: 'Tool' })
    expect(res.status).toBe(404)
  })

  it('returns updated kind', async () => {
    vi.spyOn(ResourceKind, 'findByIdAndUpdate').mockResolvedValue({ _id: 'rk1', name: 'Tool' })
    const res = await request(makeApp()).put('/access/resource-kinds/rk1').set('Authorization', AUTH).send({ name: 'Tool' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Tool')
  })
})

describe('DELETE /access/resource-kinds/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(ResourceKind, 'findByIdAndDelete').mockResolvedValue(null)
    const res = await request(makeApp()).delete('/access/resource-kinds/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('deletes successfully', async () => {
    vi.spyOn(ResourceKind, 'findByIdAndDelete').mockResolvedValue({ _id: 'rk1' })
    const res = await request(makeApp()).delete('/access/resource-kinds/rk1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
