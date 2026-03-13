const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const DeviceKind = require('./deviceKind.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/assets/device-kinds', require('./deviceKind.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

describe('GET /assets/device-kinds', () => {
  it('returns all device kinds', async () => {
    vi.spyOn(DeviceKind, 'find').mockResolvedValue([{ _id: 'dk1', name: 'Laptop' }])
    const res = await request(makeApp()).get('/assets/device-kinds').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('POST /assets/device-kinds', () => {
  it('creates and returns the kind', async () => {
    vi.spyOn(DeviceKind, 'create').mockResolvedValue({ _id: 'dk1', name: 'Laptop' })
    const res = await request(makeApp()).post('/assets/device-kinds').set('Authorization', AUTH).send({ name: 'Laptop' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Laptop')
  })
})

describe('PUT /assets/device-kinds/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(DeviceKind, 'findByIdAndUpdate').mockResolvedValue(null)
    const res = await request(makeApp()).put('/assets/device-kinds/507f1f77bcf86cd799439011').set('Authorization', AUTH).send({ name: 'Phone' })
    expect(res.status).toBe(404)
  })

  it('returns updated kind', async () => {
    vi.spyOn(DeviceKind, 'findByIdAndUpdate').mockResolvedValue({ _id: 'dk1', name: 'Phone' })
    const res = await request(makeApp()).put('/assets/device-kinds/dk1').set('Authorization', AUTH).send({ name: 'Phone' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Phone')
  })
})

describe('DELETE /assets/device-kinds/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(DeviceKind, 'findByIdAndDelete').mockResolvedValue(null)
    const res = await request(makeApp()).delete('/assets/device-kinds/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('deletes successfully', async () => {
    vi.spyOn(DeviceKind, 'findByIdAndDelete').mockResolvedValue({ _id: 'dk1' })
    const res = await request(makeApp()).delete('/assets/device-kinds/dk1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
