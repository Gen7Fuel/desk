const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const Course = require('./course.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/academy', require('./course.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

const VALID_COURSE = {
  title: 'Safety Basics',
  description: 'Learn the fundamentals',
  sections: [],
}

describe('POST /api/academy/courses', () => {
  it('returns 400 when title is missing', async () => {
    const res = await request(makeApp())
      .post('/api/academy/courses')
      .set('Authorization', AUTH)
      .send({})
    expect(res.status).toBe(400)
  })

  it('creates and returns the course', async () => {
    const doc = { _id: 'c1', ...VALID_COURSE, status: 'draft' }
    vi.spyOn(Course, 'create').mockResolvedValue(doc)
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
    vi.spyOn(Course, 'find').mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        { _id: 'c1', title: 'Course', sections: [], status: 'draft', createdAt: new Date() },
      ]),
    })
    const res = await request(makeApp())
      .get('/api/academy/courses')
      .set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /api/academy/courses/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Course, 'findById').mockResolvedValue(null)
    const res = await request(makeApp())
      .get('/api/academy/courses/507f1f77bcf86cd799439011')
      .set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns the course', async () => {
    vi.spyOn(Course, 'findById').mockResolvedValue({ _id: 'c1', ...VALID_COURSE })
    const res = await request(makeApp())
      .get('/api/academy/courses/c1')
      .set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body._id).toBe('c1')
  })
})

describe('PUT /api/academy/courses/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Course, 'findByIdAndUpdate').mockResolvedValue(null)
    const res = await request(makeApp())
      .put('/api/academy/courses/507f1f77bcf86cd799439011')
      .set('Authorization', AUTH)
      .send(VALID_COURSE)
    expect(res.status).toBe(404)
  })

  it('returns updated course', async () => {
    const updated = { _id: 'c1', ...VALID_COURSE, title: 'Updated' }
    vi.spyOn(Course, 'findByIdAndUpdate').mockResolvedValue(updated)
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
    vi.spyOn(Course, 'findByIdAndDelete').mockResolvedValue(null)
    const res = await request(makeApp())
      .delete('/api/academy/courses/507f1f77bcf86cd799439011')
      .set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns success', async () => {
    vi.spyOn(Course, 'findByIdAndDelete').mockResolvedValue({ _id: 'c1' })
    const res = await request(makeApp())
      .delete('/api/academy/courses/c1')
      .set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
