// Run inside the Desk image, with its existing environment. Never prints credentials.
const crypto = require('node:crypto')
const { BlobServiceClient } = require('@azure/storage-blob')
const tar = require('tar-stream')
const backup = require(process.env.CDN_BACKUP_MODULE || '../backend/apps/cdn/cdn.backup')
async function main() {
  const c = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
    .getContainerClient(process.env.AZURE_CONTAINER)
  const prefix = `cdn_restore_tests/backup-smoke-${crypto.randomUUID()}/`
  const map = name => name.startsWith(backup.ROOT) ? prefix + name.slice(backup.ROOT.length) : name
  const scoped = {
    getBlobClient: name => c.getBlobClient(map(name)),
    getBlockBlobClient: name => c.getBlockBlobClient(map(name)),
    async *listBlobsFlat(options) {
      for await (const blob of c.listBlobsFlat({ ...options, prefix: map(options.prefix) })) {
        yield { ...blob, name: blob.name.startsWith(prefix) ? backup.ROOT + blob.name.slice(prefix.length) : blob.name }
      }
    },
  }
  let report
  try {
    const files = (await backup.inventory(c)).filter(f => f.size > 0 && f.size < 1000000)
    const month = files.map(f => f.lastModified.slice(0, 7)).sort().at(-1)
    const sample = files.filter(f => f.lastModified.startsWith(month)).slice(0, 3)
    if (sample.length !== 3) throw new Error('Not enough sample files')
    const result = await backup.withLock(scoped, check => backup.archive(scoped, month, sample, check))
    const marker = JSON.parse((await scoped.getBlobClient(result.manifestName).downloadToBuffer()).toString())
    const body = await scoped.getBlobClient(result.blobName).downloadToBuffer()
    if (crypto.createHash('sha256').update(body).digest('hex') !== result.sha256) throw new Error('Archive readback mismatch')
    const extract = tar.extract(), restored = []
    extract.on('entry', (header, stream, next) => {
      const chunks = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => { restored.push({ header, body: Buffer.concat(chunks) }); next() })
      stream.resume()
    })
    const done = new Promise((resolve, reject) => { extract.on('finish', resolve); extract.on('error', reject) })
    extract.end(body); await done
    for (const file of marker.files) {
      const entry = restored.find(x => x.header.name === file.name)
      if (!entry || entry.body.length !== file.size || crypto.createHash('sha256').update(entry.body).digest('hex') !== file.sha256 ||
        Math.floor(entry.header.mtime.getTime() / 1000) !== Math.floor(Date.parse(file.lastModified) / 1000)) {
        throw new Error('Restored file integrity/date mismatch')
      }
    }
    // Exercise durable scheduled state and lease-fenced status writes with this three-file source view.
    const sourceNames = new Set(sample.map(f => f.source))
    const originalList = scoped.listBlobsFlat
    scoped.listBlobsFlat = async function* (options) {
      for await (const blob of originalList(options)) {
        if (options.prefix !== 'cdn/' || sourceNames.has(blob.name)) yield blob
      }
    }
    const scheduled = await backup.tick(scoped)
    if (!scheduled.results?.some(r => r.fileCount === 3)) throw new Error('Scheduled smoke failed')
    const state = await backup.status(scoped)
    if (!state.lastSuccess || state.current.phase !== 'succeeded') throw new Error('Durable success state missing')
    report = { scheduledStateVerified: true, passed: true, restoredFiles: sample.length, archiveBytes: body.length, sha256: result.sha256 }
  } finally {
    // HNS directories are real objects. Delete only this UUID subtree, deepest first.
    const objects = []
    for await (const blob of c.listBlobsFlat({ prefix })) objects.push(blob.name)
    objects.sort((a, b) => b.length - a.length)
    for (const name of objects) {
      if (!name.startsWith(prefix)) throw new Error('Unsafe smoke cleanup')
      await c.getBlobClient(name).deleteIfExists()
    }
    await c.getBlobClient(prefix.slice(0, -1)).deleteIfExists()
    for await (const _ of c.listBlobsFlat({ prefix })) throw new Error('Smoke objects remain')
  }
  console.log(JSON.stringify({ ...report, isolatedObjectsCleaned: true }))
}
main().catch(err => { console.error('Azure backup smoke failed', err.name, err.code || '', err.message?.replace(/https?:\/\/\S+/g, '[URL]')); process.exitCode = 1 })
