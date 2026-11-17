const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { Transform } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const tar = require('tar-stream')
const { BlobServiceClient } = require('@azure/storage-blob')

const { sourceContainer, sourceId } = require('./cdn.backup-source')

const ROOT = 'cdn_backup/automated/'
const STATE = `${ROOT}status.json`
const LOCK = STATE
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/
function container() {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING || !process.env.AZURE_CONTAINER) {
    throw new Error('Azure storage not configured')
  }
  return BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
    .getContainerClient(process.env.AZURE_CONTAINER)
}
async function readJson(blob, fallback = null) {
  try { return JSON.parse((await blob.downloadToBuffer()).toString()) }
  catch (err) { if (err.statusCode === 404) return fallback; throw err }
}
async function writeJson(blob, value, options = {}) {
  const body = Buffer.from(JSON.stringify(value, null, 2))
  return blob.uploadData(body, { blobHTTPHeaders: { blobContentType: 'application/json' }, ...options })
}
function calendar(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(x => [x.type, x.value]))
  const month = `${p.year}-${p.month}`
  const previous = new Date(Date.UTC(Number(p.year), Number(p.month) - 2, 1)).toISOString().slice(0, 7)
  return { date: `${month}-${p.day}`, month, previous, hour: Number(p.hour) }
}
async function status(c = container()) {
  const state = await readJson(c.getBlockBlobClient(STATE), {})
  return { schedule: 'Daily at 02:00 America/Toronto', retentionDays: 30, ...state }
}
async function enqueue(month, c = container()) {
  if (!monthPattern.test(month)) throw new Error('Invalid month (YYYY-MM)')
  const id = crypto.randomUUID()
  await writeJson(c.getBlockBlobClient(`${ROOT}requests/${id}.json`), {
    id, month, requestedAt: new Date().toISOString(), attempts: 0,
  }, { conditions: { ifNoneMatch: '*' } })
  return id
}
async function withLock(c, action) {
  const blob = c.getBlockBlobClient(LOCK)
  try { await blob.uploadData(Buffer.from('{}'), { conditions: { ifNoneMatch: '*' } }) }
  catch (err) { if (err.statusCode !== 409 && err.statusCode !== 412) throw err }
  const lease = blob.getBlobLeaseClient()
  try { await lease.acquireLease(60) }
  catch (err) { if (err.statusCode === 409) return { busy: true }; throw err }
  let lost
  let renewing = Promise.resolve()
  const check = () => { if (lost) throw new Error('Backup lock lost; stopping this run') }
  const timer = setInterval(() => {
    renewing = renewing.then(() => lease.renewLease()).catch(err => { lost = err })
  }, 15000)
  try { return await action(check, lease.leaseId) }
  finally {
    clearInterval(timer)
    await renewing
    await lease.releaseLease().catch(() => {})
  }
}
async function inventory(c) {
  const files = []
  for await (const blob of c.listBlobsFlat({ prefix: 'cdn/', includeMetadata: true })) {
    if (blob.metadata?.hdi_isfolder === 'true' || blob.properties.resourceType === 'directory') continue
    const name = blob.name.slice(4)
    if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..' || name === '.cdn-backup-manifest.json') {
      throw new Error('Unsafe CDN filename in inventory')
    }
    const modified = new Date(blob.metadata?.originalmtime || blob.properties.lastModified)
    if (!Number.isFinite(modified.getTime())) throw new Error('Invalid source modification date')
    files.push({ name, source: blob.name, size: blob.properties.contentLength, etag: blob.properties.etag,
      lastModified: modified.toISOString(), contentType: blob.properties.contentType,
      sourceSha256: blob.metadata?.sha256 })
  }
  return files.sort((a, b) => a.name.localeCompare(b.name))
}
async function archive(c, month, files, check, kind = 'daily', now = new Date(), progress = async () => {}, source = c) {
  const selected = files.filter(f => f.lastModified.startsWith(month))
  if (!selected.length) return { month, fileCount: 0, empty: true }
  await progress(month, 0, selected.length)
  const id = crypto.randomUUID()
  const base = `${ROOT}${kind}/${calendar(now).date}/${id}/cdn-${month}`
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cdn-backup-'))
  const filepath = path.join(dir, 'archive.tar')
  const pack = tar.pack()
  const archiveHash = crypto.createHash('sha256')
  const output = pipeline(pack, new Transform({ transform(chunk, _, cb) {
    archiveHash.update(chunk); cb(null, chunk)
  } }), fs.createWriteStream(filepath))
  // Attach immediately; disk/stream failures must not become unhandled rejections.
  output.catch(() => {})
  const manifest = { version: 1, source: sourceId(source), month, startedAt: now.toISOString(), files: [] }
  try {
    for (const file of selected) {
      check()
      const response = await source.getBlobClient(file.source).download(0, undefined, { conditions: { ifMatch: file.etag } })
      if (!response.readableStreamBody) throw new Error('Missing source stream')
      const hash = crypto.createHash('sha256')
      let bytes = 0
      const entry = pack.entry({ name: file.name, size: file.size, mtime: new Date(file.lastModified), mode: 0o644 })
      await pipeline(response.readableStreamBody, new Transform({ transform(chunk, _, cb) {
        bytes += chunk.length; hash.update(chunk); cb(null, chunk)
      } }), entry)
      const sha256 = hash.digest('hex')
      if (bytes !== file.size || (file.sourceSha256 && file.sourceSha256 !== sha256)) {
        throw new Error('Source size or checksum mismatch')
      }
      manifest.files.push({ ...file, sha256 })
      if (manifest.files.length % 25 === 0 || manifest.files.length === selected.length) await progress(month, manifest.files.length, selected.length)
    }
    const manifestBody = Buffer.from(JSON.stringify(manifest))
    await new Promise((resolve, reject) => pack.entry({ name: '.cdn-backup-manifest.json', size: manifestBody.length }, manifestBody,
      err => err ? reject(err) : resolve()))
    pack.finalize()
    await output
    check()
    const sha256 = archiveHash.digest('hex')
    const size = (await fs.promises.stat(filepath)).size
    const target = c.getBlockBlobClient(`${base}.tar`)
    const uploaded = await target.uploadFile(filepath, { conditions: { ifNoneMatch: '*' },
      metadata: { sha256 }, blobHTTPHeaders: { blobContentType: 'application/x-tar' } })
    // Read the entire uploaded archive back under the returned ETag before publishing success.
    const download = await target.download(0, undefined, { conditions: { ifMatch: uploaded.etag } })
    const remoteHash = crypto.createHash('sha256')
    let remoteSize = 0
    for await (const chunk of download.readableStreamBody) { check(); remoteHash.update(chunk); remoteSize += chunk.length }
    if (remoteSize !== size || remoteHash.digest('hex') !== sha256) throw new Error('Uploaded backup verification failed')
    check()
    const result = { month, source: sourceId(source), blobName: `${base}.tar`, manifestName: `${base}.json`, kind,
      fileCount: selected.length, sourceBytes: selected.reduce((n, f) => n + f.size, 0), size, sha256,
      verifiedAt: new Date().toISOString(), etag: uploaded.etag }
    // Sidecar is the completion marker; a tar without this marker is never a successful recovery point.
    await writeJson(c.getBlockBlobClient(`${base}.json`), { ...manifest, ...result }, { conditions: { ifNoneMatch: '*' } })
    return result
  } catch (err) { pack.destroy(err); await output.catch(() => {}); throw err }
  finally {
    const resolved = path.resolve(dir)
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('cdn-backup-')) {
      throw new Error('Refusing to clean an unexpected backup temp directory')
    }
    await fs.promises.rm(resolved, { recursive: true, force: true })
  }
}
async function prune(c, check, now = new Date()) {
  const cutoff = now.getTime() - 30 * 86400000
  // Only this job's dated daily archives. Legacy and permanent monthly backups are never pruned.
  const expired = []
  for await (const blob of c.listBlobsFlat({ prefix: `${ROOT}daily/` })) {
    if (blob.name.endsWith('.json') && /^cdn_backup\/automated\/daily\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\/cdn-\d{4}-\d{2}\.json$/.test(blob.name)) {
      const receipt = await readJson(c.getBlockBlobClient(blob.name))
      if (receipt?.verifiedAt && Date.parse(receipt.verifiedAt) < cutoff && receipt.blobName === blob.name.replace(/\.json$/, '.tar')) {
        expired.push({ name: blob.name, receipt })
      }
    }
  }
  for (const { name, receipt } of expired) {
    check()
    await c.getBlockBlobClient(receipt.blobName).deleteIfExists({ conditions: { ifMatch: receipt.etag } })
    await c.getBlockBlobClient(name).deleteIfExists()
  }
}
async function tick(c = container(), now = new Date(), source = sourceContainer(c)) {
  const sourceKey = sourceId(source)
  const legacySourceKey = sourceId(c)
  return withLock(c, async (check, leaseId) => {
    const state = await status(c)
    const cal = calendar(now)
    const requests = []
    for await (const b of c.listBlobsFlat({ prefix: `${ROOT}requests/` })) {
      if (b.name.endsWith('.json')) requests.push(b.name)
    }
    requests.sort()
    let request
    for (const name of requests) {
      const value = await readJson(c.getBlockBlobClient(name))
      if (value && value.attempts < 3 && (!value.retryAfter || Date.parse(value.retryAfter) <= now.getTime())) {
        request = { name, ...value }; break
      }
    }
    const due = cal.hour >= 2 && (state.lastScheduledDate !== cal.date || (state.lastScheduledSource || legacySourceKey) !== sourceKey) &&
      (!state.retryAfter || Date.parse(state.retryAfter) <= now.getTime())
    state.configuredSource = sourceKey
    state.workerLastSeenAt = now.toISOString()
    if (!request && !due) {
      check(); await writeJson(c.getBlockBlobClient(STATE), state, { conditions: { leaseId } })
      return { idle: true }
    }
    const startedAt = now.toISOString()
    const save = async () => { check(); await writeJson(c.getBlockBlobClient(STATE), state, { conditions: { leaseId } }) }
    state.current = { phase: 'running', source: sourceKey, startedAt, month: request?.month || cal.month, trigger: request ? 'manual' : 'scheduled' }
    await save()
    try {
      const files = await inventory(source)
      if (!files.length) throw new Error('CDN inventory is empty; refusing to claim a successful backup')
      if (request && !files.some(f => f.lastModified.startsWith(request.month))) throw new Error('No files in requested month')
      const progress = async (month, completedFiles, totalFiles) => {
        state.current = { ...state.current, month, completedFiles, totalFiles }
        state.workerLastSeenAt = new Date().toISOString()
        await save()
      }
      const results = []
      if (!request && (state.lastFinalizedMonth !== cal.previous || (state.lastFinalizedSource || legacySourceKey) !== sourceKey)) {
        results.push(await archive(c, cal.previous, files, check, 'monthly', now, progress, source))
        state.lastFinalizedMonth = cal.previous
        state.lastFinalizedSource = sourceKey
        await save()
      }
      results.push(await archive(c, request?.month || cal.month, files, check, request ? 'monthly' : 'daily', now, progress, source))
      const success = { source: sourceKey, startedAt, completedAt: new Date().toISOString(), trigger: request ? 'manual' : 'scheduled', results }
      state.lastSuccess = success
      state.current = { phase: 'succeeded', ...success }
      state.consecutiveFailures = 0
      delete state.retryAfter
      if (!request) { state.lastScheduledDate = cal.date; state.lastScheduledSource = sourceKey }
      await save()
      if (request) await c.getBlockBlobClient(request.name).deleteIfExists()
      // Retention only follows a verified successful scheduled run.
      if (!request) {
        try { await prune(c, check, now); delete state.retentionWarning }
        catch (_) { state.retentionWarning = 'Backup verified, but expiry cleanup failed. Older copies were retained.' }
        await save()
      }
      return success
    } catch (err) {
      state.consecutiveFailures = (state.consecutiveFailures || 0) + 1
      state.current = { phase: 'failed', source: sourceKey, startedAt, failedAt: new Date().toISOString(),
        month: request?.month || cal.month, message: 'Backup failed; see worker logs. Last successful backup is retained.' }
      state.retryAfter = new Date(now.getTime() + 15 * 60000).toISOString()
      await save()
      if (request) await writeJson(c.getBlockBlobClient(request.name), {
        id: request.id, month: request.month, requestedAt: request.requestedAt,
        attempts: request.attempts + 1, retryAfter: state.retryAfter,
      })
      throw err
    }
  })
}
module.exports = { ROOT, status, enqueue, tick, archive, inventory, calendar, withLock, prune }
