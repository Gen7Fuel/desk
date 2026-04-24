const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

beforeEach(() => {
  process.env.ACADEMY_BASE = 'https://hub.test'
  process.env.ACADEMY_ADMIN_TOKEN = 'test-token'
})

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/academy', require('./employee.routes'))
  return app
}

function mockFetch(status, body) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }),
  )
}

afterEach(() => vi.restoreAllMocks())

describe('GET /api/academy/employees', () => {
  it('returns list of employees', async () => {
    const employees = [{ _id: 'e1', name: 'Jane Doe', code: 'EMP-ABC123', createdAt: new Date().toISOString() }]
    mockFetch(200, { employees })
    const res = await request(makeApp())
      .get('/api/academy/employees')
      .set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].code).toBe('EMP-ABC123')
  })
})

describe('POST /api/academy/employees', () => {
  it('returns 400 when name is missing', async () => {
    mockFetch(400, { message: 'name is required' })
    const res = await request(makeApp())
      .post('/api/academy/employees')
      .set('Authorization', AUTH)
      .send({})
    expect(res.status).toBe(400)
  })

  it('creates and returns the employee with a generated code', async () => {
    const employee = { _id: 'e1', name: 'Jane Doe', code: 'EMP-ABC123', createdAt: new Date().toISOString() }
    mockFetch(201, employee)
    const res = await request(makeApp())
      .post('/api/academy/employees')
      .set('Authorization', AUTH)
      .send({ name: 'Jane Doe' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Jane Doe')
    expect(res.body.code).toMatch(/^EMP-/)
  })
})

describe('DELETE /api/academy/employees/:id', () => {
  it('returns 404 when not found', async () => {
    mockFetch(404, { message: 'Employee not found' })
    const res = await request(makeApp())
      .delete('/api/academy/employees/507f1f77bcf86cd799439011')
      .set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns success', async () => {
    mockFetch(200, { message: 'Employee deleted' })
    const res = await request(makeApp())
      .delete('/api/academy/employees/e1')
      .set('Authorization', AUTH)
    expect(res.status).toBe(200)
  })
})
