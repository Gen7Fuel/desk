const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const FleetCard = require('./fleet-card.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', require('./fleet-card.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

const VALID_BODY = { cardNumber: '1234567890123456', accountName: 'Acme Corp' }

describe('GET /api/fleet-cards', () => {
  it('returns 200 and an array of cards sorted by accountName, driverName', async () => {
    const cards = [{ _id: 'fc1', ...VALID_BODY, driverName: 'Alice' }]
    vi.spyOn(FleetCard, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue(cards) })
    const res = await request(makeApp()).get('/api/fleet-cards').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /api/fleet-cards/:id', () => {
  it('returns 200 with the card when found', async () => {
    vi.spyOn(FleetCard, 'findById').mockResolvedValue({ _id: 'fc1', ...VALID_BODY })
    const res = await request(makeApp()).get('/api/fleet-cards/fc1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body._id).toBe('fc1')
  })

  it('returns 404 when not found', async () => {
    vi.spyOn(FleetCard, 'findById').mockResolvedValue(null)
    const res = await request(makeApp()).get('/api/fleet-cards/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })
})

describe('POST /api/fleet-cards', () => {
  it('returns 400 when cardNumber is missing', async () => {
    const res = await request(makeApp()).post('/api/fleet-cards').set('Authorization', AUTH).send({ accountName: 'Acme Corp' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when accountName is missing', async () => {
    const res = await request(makeApp()).post('/api/fleet-cards').set('Authorization', AUTH).send({ cardNumber: '1234567890123456' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when cardNumber is not exactly 16 digits', async () => {
    const res = await request(makeApp()).post('/api/fleet-cards').set('Authorization', AUTH).send({ cardNumber: '12345', accountName: 'Acme Corp' })
    expect(res.status).toBe(400)
  })

  it('returns 201 with the created card on success', async () => {
    vi.spyOn(FleetCard, 'create').mockResolvedValue({ _id: 'fc1', ...VALID_BODY })
    const res = await request(makeApp()).post('/api/fleet-cards').set('Authorization', AUTH).send(VALID_BODY)
    expect(res.status).toBe(201)
    expect(res.body._id).toBe('fc1')
  })

  it('returns 409 when card number already exists', async () => {
    vi.spyOn(FleetCard, 'create').mockRejectedValue({ code: 11000 })
    const res = await request(makeApp()).post('/api/fleet-cards').set('Authorization', AUTH).send(VALID_BODY)
    expect(res.status).toBe(409)
  })
})

describe('PUT /api/fleet-cards/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(FleetCard, 'findByIdAndUpdate').mockResolvedValue(null)
    const res = await request(makeApp()).put('/api/fleet-cards/507f1f77bcf86cd799439011').set('Authorization', AUTH).send(VALID_BODY)
    expect(res.status).toBe(404)
  })

  it('returns 400 when cardNumber is provided but not 16 digits', async () => {
    const res = await request(makeApp()).put('/api/fleet-cards/fc1').set('Authorization', AUTH).send({ cardNumber: '999' })
    expect(res.status).toBe(400)
  })

  it('returns 200 with updated card on success', async () => {
    const updated = { _id: 'fc1', ...VALID_BODY, driverName: 'Bob' }
    vi.spyOn(FleetCard, 'findByIdAndUpdate').mockResolvedValue(updated)
    const res = await request(makeApp()).put('/api/fleet-cards/fc1').set('Authorization', AUTH).send({ ...VALID_BODY, driverName: 'Bob' })
    expect(res.status).toBe(200)
    expect(res.body.driverName).toBe('Bob')
  })
})

describe('DELETE /api/fleet-cards/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(FleetCard, 'findByIdAndDelete').mockResolvedValue(null)
    const res = await request(makeApp()).delete('/api/fleet-cards/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns 200 { success: true } on success', async () => {
    vi.spyOn(FleetCard, 'findByIdAndDelete').mockResolvedValue({ _id: 'fc1' })
    const res = await request(makeApp()).delete('/api/fleet-cards/fc1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
