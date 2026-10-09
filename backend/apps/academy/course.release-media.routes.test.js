const request = require('supertest')
const express = require('express')
const { authHeader } = require('../../tests/helpers/auth')
const { buildDefaultPermissions } = require('../../lib/permissions')

const mediaStorage = require('./media-storage')
let deleteMediaAtPath

const AUTH = authHeader({ permissions: buildDefaultPermissions(true) })
const CONTAINER = 'media'
const master = (folder, id) => `academy/${folder}/videos/${id}/master.m3u8`
const sas = (blobPath, sig = 'abc') =>
  `https://acct.blob.core.windows.net/${CONTAINER}/${blobPath}?sv=1&sig=${sig}`
const courseWith = (id, url) => ({ _id: id, sections: [{ items: [{ type: 'video', content: { url } }] }] })

beforeEach(() => {
  process.env.ACADEMY_BASE = 'https://hub.test'
  process.env.ACADEMY_ADMIN_TOKEN = 'test-token'
  process.env.AZURE_CONTAINER = CONTAINER
  deleteMediaAtPath = vi.spyOn(mediaStorage, 'deleteMediaAtPath').mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/academy', require('./course.routes'))
  return app
}

/** Hub mock: the course list plus one detail response per course id. */
function mockHub(courses, { failDetailFor } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (url.endsWith('/api/academy/admin/courses')) {
        return { ok: true, status: 200, json: async () => ({ courses: courses.map((c) => ({ _id: c._id })) }) }
      }
      const id = url.split('/').pop()
      if (id === failDetailFor) return { ok: false, status: 500, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => courses.find((c) => c._id === id) }
    }),
  )
}

const release = (url, courseId = 'c1') =>
  request(makeApp()).post(`/api/academy/courses/${courseId}/release-media`).set('Authorization', AUTH).send({ url })

describe('POST /api/academy/courses/:id/release-media', () => {
  const oldVideo = sas(master('c1-safety', 'old'))

  it('requires a url', async () => {
    const res = await request(makeApp()).post('/api/academy/courses/c1/release-media').set('Authorization', AUTH).send({})
    expect(res.status).toBe(400)
  })

  it("deletes the video when it is in the course's folder and nothing references it", async () => {
    mockHub([courseWith('c1', sas(master('c1-safety', 'new'))), courseWith('c2', sas(master('c2-other', 'x')))])
    const res = await release(oldVideo)
    expect(res.body).toEqual({ released: true })
    expect(deleteMediaAtPath).toHaveBeenCalledWith(master('c1-safety', 'old'))
  })

  it('keeps it when another entry in the same course still uses it (even via a new SAS URL)', async () => {
    mockHub([courseWith('c1', sas(master('c1-safety', 'old'), 'fresh-sig'))])
    const res = await release(oldVideo)
    expect(res.body).toEqual({ released: false, reason: 'in-use' })
    expect(deleteMediaAtPath).not.toHaveBeenCalled()
  })

  it('keeps it when a different course uses it', async () => {
    mockHub([courseWith('c1', ''), courseWith('c2', sas(master('c1-safety', 'old')))])
    const res = await release(oldVideo)
    expect(res.body).toEqual({ released: false, reason: 'in-use' })
    expect(deleteMediaAtPath).not.toHaveBeenCalled()
  })

  it('never deletes from the shared library or another course folder', async () => {
    mockHub([courseWith('c1', '')])
    for (const folder of ['_library', 'c2-other']) {
      const res = await release(sas(master(folder, 'v')))
      expect(res.body).toEqual({ released: false, reason: 'not-in-course-folder' })
    }
    expect(deleteMediaAtPath).not.toHaveBeenCalled()
  })

  it('ignores URLs that are not in storage', async () => {
    mockHub([courseWith('c1', '')])
    const res = await release('https://example.com/video.mp4')
    expect(res.body).toEqual({ released: false, reason: 'not-in-storage' })
    expect(deleteMediaAtPath).not.toHaveBeenCalled()
  })

  it('deletes nothing when it cannot check every course', async () => {
    mockHub([courseWith('c1', ''), courseWith('c2', '')], { failDetailFor: 'c2' })
    const res = await release(oldVideo)
    expect(res.status).toBe(500)
    expect(deleteMediaAtPath).not.toHaveBeenCalled()
  })
})
