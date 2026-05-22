const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')
const Project = require('./project.model')
const Task = require('./task.model')
const ProjectTemplate = require('./project-template.model')

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })
const USER_ID = '507f1f77bcf86cd799439011'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', require('./projects.routes'))
  return app
}

afterEach(() => vi.restoreAllMocks())

const VALID_PROJECT = { name: 'Site Alpha', startDate: '2026-01-01' }

describe('POST /api/projects', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(makeApp()).post('/api/projects').set('Authorization', AUTH).send({ name: 'x' })
    expect(res.status).toBe(400)
  })

  it('creates a project without template', async () => {
    vi.spyOn(Project, 'create').mockResolvedValue({ _id: 'p1', ...VALID_PROJECT, createdBy: USER_ID })
    const res = await request(makeApp()).post('/api/projects').set('Authorization', AUTH).send(VALID_PROJECT)
    expect(res.status).toBe(201)
    expect(res.body.project._id).toBe('p1')
  })

  it('creates tasks from template when templateId is provided', async () => {
    const mockTemplate = {
      _id: 't1',
      tasks: [
        { name: 'Task A', durationDays: 3, order: 1, dependsOnPrevious: false },
        { name: 'Task B', durationDays: 5, order: 2, dependsOnPrevious: true },
      ],
    }
    vi.spyOn(Project, 'create').mockResolvedValue({ _id: 'p1', ...VALID_PROJECT, createdBy: USER_ID })
    vi.spyOn(ProjectTemplate, 'findById').mockResolvedValue(mockTemplate)
    vi.spyOn(Task, 'insertMany').mockResolvedValue([])
    const res = await request(makeApp())
      .post('/api/projects')
      .set('Authorization', AUTH)
      .send({ ...VALID_PROJECT, templateId: 't1' })
    expect(res.status).toBe(201)
    expect(Task.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Task A' })])
    )
  })
})

describe('GET /api/projects/:id', () => {
  it('returns 404 when not found', async () => {
    vi.spyOn(Project, 'findById').mockReturnValue({ populate: vi.fn().mockResolvedValue(null) })
    const res = await request(makeApp())
      .get('/api/projects/507f1f77bcf86cd799439011')
      .set('Authorization', AUTH)
    expect(res.status).toBe(404)
  })

  it('returns project with tasks', async () => {
    const mockProject = { _id: 'p1', name: 'Site Alpha' }
    vi.spyOn(Project, 'findById').mockReturnValue({
      populate: vi.fn().mockResolvedValue(mockProject),
    })
    vi.spyOn(Task, 'find').mockReturnValue({
      populate: vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue([{ _id: 'tk1', name: 'Task A' }]) }),
    })
    const res = await request(makeApp()).get('/api/projects/p1').set('Authorization', AUTH)
    expect(res.status).toBe(200)
    expect(res.body.project._id).toBe('p1')
    expect(res.body.tasks).toHaveLength(1)
  })
})

describe('PUT /api/projects/:id/tasks/:taskId', () => {
  it('returns 404 when task not found', async () => {
    vi.spyOn(Task, 'findOneAndUpdate').mockReturnValue({ populate: vi.fn().mockResolvedValue(null) })
    const res = await request(makeApp())
      .put('/api/projects/p1/tasks/507f1f77bcf86cd799439011')
      .set('Authorization', AUTH)
      .send({ progress: 50 })
    expect(res.status).toBe(404)
  })

  it('updates task progress', async () => {
    const mockTask = { _id: 'tk1', name: 'Task A', progress: 50 }
    vi.spyOn(Task, 'findOneAndUpdate').mockReturnValue({ populate: vi.fn().mockResolvedValue(mockTask) })
    const res = await request(makeApp())
      .put('/api/projects/p1/tasks/tk1')
      .set('Authorization', AUTH)
      .send({ progress: 50 })
    expect(res.status).toBe(200)
    expect(res.body.task.progress).toBe(50)
  })
})
