const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const Personnel = require('./personnel.model')
const ResourceKind = require('../access/resourceKind.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/personnel', require('./personnel.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

describe('GET /personnel', () => {
  it('returns list of personnel', async () => {
    vi.spyOn(Personnel, 'find').mockResolvedValue([{ _id: 'p1', name: 'Alice' }])
    const res = await request(makeApp()).get('/personnel').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /personnel/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Personnel, 'findById').mockResolvedValue(null)
    const res = await request(makeApp()).get('/personnel/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns the personnel document', async () => {
    vi.spyOn(Personnel, 'findById').mockResolvedValue({ _id: 'p1', name: 'Alice' })
    const res = await request(makeApp()).get('/personnel/p1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body._id).toBe('p1')
  })
})

describe('POST /personnel', () => {
  it('creates personnel without resources', async () => {
    vi.spyOn(Personnel, 'create').mockResolvedValue({ _id: 'p1', name: 'Alice' })
    const res = await request(makeApp()).post('/personnel').set('Authorization', AUTH).send({ name: 'Alice' })
    expect(res.status).toBe(201)
    expect(res.body._id).toBe('p1')
  })

  it('creates personnel with valid resource types', async () => {
    vi.spyOn(ResourceKind, 'find').mockReturnValue({
      select: vi.fn().mockResolvedValue([{ name: 'Vehicle' }]),
    })
    vi.spyOn(Personnel, 'create').mockResolvedValue({ _id: 'p1', name: 'Alice', resources: [{ type: 'Vehicle', id: 'v1' }] })

    const res = await request(makeApp())
      .post('/personnel')
      .set('Authorization', AUTH)
      .send({ name: 'Alice', resources: [{ type: 'Vehicle', id: 'v1' }] })

    expect(res.status).toBe(201)
  })

  it('returns 400 when resource type is unknown', async () => {
    vi.spyOn(ResourceKind, 'find').mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    })

    const res = await request(makeApp())
      .post('/personnel')
      .set('Authorization', AUTH)
      .send({ name: 'Alice', resources: [{ type: 'Ghost', id: 'g1' }] })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/unknown resource types/i)
  })
})

describe('PUT /personnel/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Personnel, 'findByIdAndUpdate').mockResolvedValue(null)
    const res = await request(makeApp()).put('/personnel/507f1f77bcf86cd799439011').set('Authorization', AUTH).send({ name: 'Bob' })
    expect(res.status).toBe(404)
  })

  it('updates and returns personnel', async () => {
    vi.spyOn(Personnel, 'findByIdAndUpdate').mockResolvedValue({ _id: 'p1', name: 'Bob' })
    const res = await request(makeApp()).put('/personnel/p1').set('Authorization', AUTH).send({ name: 'Bob' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Bob')
  })
})

describe('DELETE /personnel/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Personnel, 'findByIdAndDelete').mockResolvedValue(null)
    const res = await request(makeApp()).delete('/personnel/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('deletes successfully', async () => {
    vi.spyOn(Personnel, 'findByIdAndDelete').mockResolvedValue({ _id: 'p1' })
    const res = await request(makeApp()).delete('/personnel/p1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
