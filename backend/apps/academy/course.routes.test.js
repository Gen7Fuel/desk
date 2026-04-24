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
  app.use('/api/academy', require('./course.routes'))
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

const VALID_COURSE = {
  title: 'Safety Basics',
  description: 'Learn the fundamentals',
  sections: [],
}

describe('POST /api/academy/courses', () => {
  it('returns 400 when title is missing', async () => {
    mockFetch(400, { message: 'title is required' })
    const res = await request(makeApp())
      .post('/api/academy/courses')
      .set('Authorization', AUTH)
      .send({})
    expect(res.status).toBe(400)
  })

  it('creates and returns the course', async () => {
    const doc = { _id: 'c1', ...VALID_COURSE, status: 'draft' }
    mockFetch(201, doc)
    const res = await request(makeApp())
      .post('/api/academy/courses')
      .set('Authorization', AUTH)
      .send(VALID_COURSE)
    expect(res.status).toBe(201)
    expect(res.body._id).toBe('c1')
  })
})

describe('GET /api/academy/courses', () => {
  it('returns list of courses', async () => {
    const courses = [{ _id: 'c1', title: 'Course', sectionCount: 0, status: 'draft', createdAt: new Date().toISOString() }]
    mockFetch(200, { courses })
    const res = await request(makeApp())
      .get('/api/academy/courses')
      .set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /api/academy/courses/:id', () => {
  it('returns 404 when not found', async () => {
    mockFetch(404, { message: 'Course not found' })
    const res = await request(makeApp())
      .get('/api/academy/courses/507f1f77bcf86cd799439011')
      .set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns the course', async () => {
    mockFetch(200, { _id: 'c1', ...VALID_COURSE })
    const res = await request(makeApp())
      .get('/api/academy/courses/c1')
      .set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body._id).toBe('c1')
  })
})

describe('PUT /api/academy/courses/:id', () => {
  it('returns 404 when not found', async () => {
    mockFetch(404, { message: 'Course not found' })
    const res = await request(makeApp())
      .put('/api/academy/courses/507f1f77bcf86cd799439011')
      .set('Authorization', AUTH)
      .send(VALID_COURSE)
    expect(res.status).toBe(404)
  })

  it('returns updated course', async () => {
    const updated = { _id: 'c1', ...VALID_COURSE, title: 'Updated' }
    mockFetch(200, updated)
    const res = await request(makeApp())
      .put('/api/academy/courses/c1')
      .set('Authorization', AUTH)
      .send({ ...VALID_COURSE, title: 'Updated' })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated')
  })
})

describe('DELETE /api/academy/courses/:id', () => {
  it('returns 404 when not found', async () => {
    mockFetch(404, { message: 'Course not found' })
    const res = await request(makeApp())
      .delete('/api/academy/courses/507f1f77bcf86cd799439011')
      .set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns success', async () => {
    mockFetch(200, { message: 'Course deleted' })
    const res = await request(makeApp())
      .delete('/api/academy/courses/c1')
      .set('Authorization', AUTH)
    expect(res.status).toBe(200)
  })
})
