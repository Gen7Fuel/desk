const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const { Readable } = require('node:stream')
const tar = require('tar-stream')
const { archive, tick, status, enqueue, calendar, ROOT, withLock, prune } = require('./cdn.backup')

function storage() {
  const blobs = new Map()
  let version = 0
  const error = n => Object.assign(new Error(`HTTP ${n}`), { statusCode: n })
  const c = {
    blobs, corrupt: false, failSource: false,
    async *listBlobsFlat({ prefix }) {
      for (const [name, b] of blobs) if (name.startsWith(prefix)) yield {
        name, metadata: b.metadata || {}, properties: { contentLength: b.body.length, etag: b.etag,
          lastModified: new Date('2026-11-16T07:00:00Z'), contentType: 'text/plain' },
      }
    },
    getBlockBlobClient(name) { return c.getBlobClient(name) },
    getBlobClient(name) {
      const check = options => {
        const b = blobs.get(name)
        if (options?.conditions?.ifNoneMatch === '*' && b) throw error(412)
        if (options?.conditions?.ifMatch && b?.etag !== options.conditions.ifMatch) throw error(412)
        if (b?.lease && b.lease !== options?.conditions?.leaseId) throw error(412)
      }
      return {
        async uploadData(body, options) {
          check(options)
          const etag = `v${++version}`
          blobs.set(name, { body: Buffer.from(body), etag, metadata: options?.metadata, lease: blobs.get(name)?.lease })
          return { etag }
        },
        async uploadFile(file, options) { return this.uploadData(await fs.readFile(file), options) },
        async downloadToBuffer() { if (!blobs.has(name)) throw error(404); return blobs.get(name).body },
        async download(_, __, options) {
          if (!blobs.has(name)) throw error(404)
          check(options)
          if (c.failSource && name.startsWith('cdn/')) throw error(503)
          return { readableStreamBody: Readable.from([c.corrupt && name.endsWith('.tar') ? Buffer.from('bad archive') : blobs.get(name).body]) }
        },
        async deleteIfExists(options) { check(options); return { succeeded: blobs.delete(name) } },
        getBlobLeaseClient() {
          const leaseId = crypto.randomUUID()
          return { leaseId,
            async acquireLease() { if (blobs.get(name).lease) throw error(409); blobs.get(name).lease = leaseId },
            async renewLease() { if (blobs.get(name)?.lease !== leaseId) throw error(412) },
            async releaseLease() { if (blobs.get(name)?.lease === leaseId) delete blobs.get(name).lease },
          }
        },
      }
    },
  }
  c.seed = async (name, body = 'hello', date = '2026-11-10T12:34:56.000Z') => {
    await c.getBlockBlobClient(name).uploadData(Buffer.from(body), { metadata: {
      originalmtime: date, sha256: crypto.createHash('sha256').update(body).digest('hex'),
    } })
  }
  return c
}

test('archive restores original bytes, dates and checksums and verifies Azure readback', async () => {
  const c = storage(); await c.seed('cdn/a.txt')
  const { inventory } = require('./cdn.backup')
  const result = await archive(c, '2026-11', await inventory(c), () => {})
  assert.equal(result.fileCount, 1)
  const extract = tar.extract(); const entries = []
  extract.on('entry', (header, stream, next) => {
    const chunks = []; stream.on('data', c => chunks.push(c))
    stream.on('end', () => { entries.push({ header, body: Buffer.concat(chunks) }); next() })
    stream.resume()
  })
  const done = new Promise((resolve, reject) => { extract.on('finish', resolve); extract.on('error', reject) })
  extract.end(c.blobs.get(result.blobName).body); await done
  assert.equal(entries[0].body.toString(), 'hello')
  assert.equal(entries[0].header.mtime.toISOString(), '2026-11-10T12:34:56.000Z')
  const manifest = JSON.parse(entries[1].body)
  assert.equal(manifest.files[0].sha256, crypto.createHash('sha256').update('hello').digest('hex'))
  assert.equal(JSON.parse(c.blobs.get(result.manifestName).body).sha256, result.sha256)
})
test('corrupt upload and failed source cannot publish a successful recovery point', async () => {
  for (const mode of ['corrupt', 'failSource']) {
    const c = storage(); await c.seed('cdn/a.txt'); c[mode] = true
    const { inventory } = require('./cdn.backup')
    await assert.rejects(archive(c, '2026-11', await inventory(c), () => {}))
    assert.equal([...c.blobs.keys()].filter(n => n.startsWith(ROOT) && n.endsWith('.json')).length, 0)
  }
})
test('schedule respects Toronto DST, only runs once per day, closes previous month', async () => {
  assert.equal(calendar(new Date('2026-07-02T06:00:00Z')).hour, 2)
  assert.equal(calendar(new Date('2026-11-16T07:00:00Z')).hour, 2)
  const c = storage(); await c.seed('cdn/nov.txt'); await c.seed('cdn/oct.txt', 'oct', '2026-10-31T23:59:59Z')
  assert.equal((await tick(c, new Date('2026-11-16T06:00:00Z'))).idle, true)
  const first = await tick(c, new Date('2026-11-16T07:00:00Z'))
  assert.equal(first.results.length, 2); assert.equal(first.results[0].kind, 'monthly')
  assert.equal((await tick(c, new Date('2026-11-16T08:00:00Z'))).idle, true)
  const next = await tick(c, new Date('2026-11-17T07:00:00Z'))
  assert.equal(next.results.length, 1)
})
test('failure retains last success and retries; requests remain durable until verified', async () => {
  const c = storage(); await c.seed('cdn/a.txt')
  await tick(c, new Date('2026-11-16T07:00:00Z'))
  const last = (await status(c)).lastSuccess
  await enqueue('2026-11', c); c.corrupt = true
  await assert.rejects(tick(c, new Date('2026-11-16T08:00:00Z')))
  assert.deepEqual((await status(c)).lastSuccess, last)
  assert.equal((await status(c)).current.phase, 'failed')
  assert.equal((await tick(c, new Date('2026-11-16T08:01:00Z'))).idle, true)
  c.corrupt = false
  await tick(c, new Date('2026-11-16T08:16:00Z'))
  assert.equal([...c.blobs.keys()].some(n => n.startsWith(`${ROOT}requests/`)), false)
})
test('shared renewable lease prevents simultaneous manual and scheduled work', async () => {
  const c = storage(); let release
  const first = withLock(c, () => new Promise(resolve => { release = resolve }))
  while (!release) await new Promise(resolve => setImmediate(resolve))
  assert.equal((await tick(c)).busy, true)
  release(); await first
  assert.equal((await tick(c, new Date('2026-11-16T06:00:00Z'))).idle, true)
})
test('retention only deletes verified daily pairs older than 30 days', async () => {
  const c = storage(); await c.seed('cdn/a.txt')
  const { inventory } = require('./cdn.backup')
  const result = await archive(c, '2026-11', await inventory(c), () => {})
  const marker = JSON.parse(c.blobs.get(result.manifestName).body)
  marker.verifiedAt = '2026-10-01T00:00:00Z'
  await c.getBlockBlobClient(result.manifestName).uploadData(Buffer.from(JSON.stringify(marker)))
  await c.seed('cdn_backup/cdn-2026-10.tar')
  await c.seed(`${ROOT}monthly/old.tar`)
  await c.seed(`${ROOT}daily/unknown.tar`)
  await prune(c, () => {}, new Date('2026-11-16T07:00:00Z'))
  assert.equal(c.blobs.has(result.blobName), false)
  assert.equal(c.blobs.has('cdn_backup/cdn-2026-10.tar'), true)
  assert.equal(c.blobs.has(`${ROOT}monthly/old.tar`), true)
  assert.equal(c.blobs.has(`${ROOT}daily/unknown.tar`), true)
})

test('empty source inventory fails instead of claiming a backup', async () => {
  const c = storage()
  await assert.rejects(tick(c, new Date('2026-11-16T07:00:00Z')))
  assert.equal((await status(c)).lastSuccess, undefined)
  assert.equal((await status(c)).current.phase, 'failed')
})

test('manual API contract returns 202 and status, validates month and keeps auth', async () => {
  const Module = require('node:module')
  const originalLoad = Module._load
  const backup = require('./cdn.backup')
  const oldEnqueue = backup.enqueue, oldStatus = backup.status
  backup.enqueue = async month => { assert.equal(month, '2026-11'); return 'test-request' }
  backup.status = async () => ({ schedule: 'Daily at 02:00 America/Toronto', lastSuccess: null })
  Module._load = function(name, parent, main) {
    if (name === '../../middleware/auth' && parent.filename.endsWith('cdn.routes.js')) return {
      authenticate: (req, res, next) => req.headers.authorization === 'Bearer test' ? next() : res.sendStatus(401),
      requirePermission: (area, action) => {
        assert.equal(area, 'hub.cdn'); assert.ok(['read', 'delete'].includes(action))
        return (_req, _res, next) => next()
      },
    }
    return originalLoad.call(this, name, parent, main)
  }
  try {
    const express = require('express'), request = require('supertest')
    const app = express(); app.use('/api', require('./cdn.routes'))
    assert.equal((await request(app).post('/api/cdn/backup?month=2026-11')).status, 401)
    assert.equal((await request(app).post('/api/cdn/backup?month=2026-13').set('Authorization', 'Bearer test')).status, 400)
    const accepted = await request(app).post('/api/cdn/backup?month=2026-11').set('Authorization', 'Bearer test')
    assert.equal(accepted.status, 202); assert.equal(accepted.body.id, 'test-request')
    assert.equal((await request(app).get('/api/cdn/backup/status').set('Authorization', 'Bearer test')).status, 200)
  } finally { Module._load = originalLoad; backup.enqueue = oldEnqueue; backup.status = oldStatus }
})
