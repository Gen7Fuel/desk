const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const Subscription = require('./subscription.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', require('./subscription.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

const VALID_BODY = {
  category: 'SaaS',
  identifier: 'Slack Pro',
  price: 12.99,
  billing_cycle: 'monthly',
  end_date: '2025-12-31',
}

describe('POST /api/subscriptions', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(makeApp()).post('/api/subscriptions').set('Authorization', AUTH).send({ category: 'SaaS' })
    expect(res.status).toBe(400)
  })

  it('creates and returns the subscription', async () => {
    const doc = { _id: 's1', ...VALID_BODY }
    vi.spyOn(Subscription, 'create').mockResolvedValue(doc)

    const res = await request(makeApp()).post('/api/subscriptions').set('Authorization', AUTH).send(VALID_BODY)

    expect(res.status).toBe(201)
    expect(res.body._id).toBe('s1')
    expect(Subscription.create).toHaveBeenCalledTimes(1)
  })
})

describe('GET /api/subscriptions', () => {
  it('returns list of subscriptions', async () => {
    vi.spyOn(Subscription, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue([{ _id: 's1' }]) })

    const res = await request(makeApp()).get('/api/subscriptions').set('Authorization', AUTH)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /api/subscriptions/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Subscription, 'findById').mockResolvedValue(null)
    const res = await request(makeApp()).get('/api/subscriptions/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns the subscription', async () => {
    vi.spyOn(Subscription, 'findById').mockResolvedValue({ _id: 's1', ...VALID_BODY })
    const res = await request(makeApp()).get('/api/subscriptions/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body._id).toBe('s1')
  })
})

describe('PUT /api/subscriptions/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Subscription, 'findByIdAndUpdate').mockResolvedValue(null)
    const res = await request(makeApp()).put('/api/subscriptions/507f1f77bcf86cd799439011').set('Authorization', AUTH).send(VALID_BODY)
    expect(res.status).toBe(404)
  })

  it('returns updated subscription', async () => {
    const updated = { _id: 's1', ...VALID_BODY, price: 15 }
    vi.spyOn(Subscription, 'findByIdAndUpdate').mockResolvedValue(updated)

    const res = await request(makeApp()).put('/api/subscriptions/s1').set('Authorization', AUTH).send({ ...VALID_BODY, price: 15 })

    expect(res.status).toBe(200)
    expect(res.body.price).toBe(15)
  })
})

describe('DELETE /api/subscriptions/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Subscription, 'findByIdAndDelete').mockResolvedValue(null)
    const res = await request(makeApp()).delete('/api/subscriptions/507f1f77bcf86cd799439011').set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns success true', async () => {
    vi.spyOn(Subscription, 'findByIdAndDelete').mockResolvedValue({ _id: 's1' })
    const res = await request(makeApp()).delete('/api/subscriptions/s1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
