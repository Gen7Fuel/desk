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
  app.use('/api/academy', require('./completion.routes'))
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

const COMPLETION = {
  _id: 'cp1',
  employeeCode: 'EMP-ABC123',
  employeeName: 'Jane Doe',
  courseId: 'c1',
  courseTitle: 'Safety Basics',
  completedAt: new Date().toISOString(),
}

describe('GET /api/academy/completions', () => {
  it('returns all completions', async () => {
    mockFetch(200, { completions: [COMPLETION] })
    const res = await request(makeApp())
      .get('/api/academy/completions')
      .set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].employeeCode).toBe('EMP-ABC123')
  })

  it('forwards courseId query param to Hub', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ completions: [COMPLETION] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await request(makeApp())
      .get('/api/academy/completions?courseId=c1')
      .set('Authorization', AUTH)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('courseId=c1'),
      expect.any(Object),
    )
  })

  it('returns empty list when no completions', async () => {
    mockFetch(200, { completions: [] })
    const res = await request(makeApp())
      .get('/api/academy/completions')
      .set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(0)
  })
})
