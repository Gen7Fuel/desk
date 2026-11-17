const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const http = require('node:http')
const { BlobServiceClient } = require('@azure/storage-blob')
const { verifyArchive } = require('./cdn.backup-readback')
const body = Buffer.from('synthetic-backup-archive')
const sha256 = crypto.createHash('sha256').update(body).digest('hex')
const args = { size: body.length, etag: 'fixed-etag', sha256, check() {} }

test('interrupted range is retried without duplicating bytes in the archive hash', async () => {
  const calls = [], delays = []
  let failed = false
  await verifyArchive({ async downloadToBuffer(offset, count, options) {
    assert.equal(options.conditions.ifMatch, args.etag)
    assert.equal(options.maxRetryRequests, 0)
    calls.push(offset)
    if (offset === 4 && !failed) { failed = true; throw Object.assign(new Error('interrupted'), { name: 'AbortError' }) }
    return body.subarray(offset, offset + count)
  } }, args, { rangeBytes: 4, delay: async ms => delays.push(ms) })
  assert.equal(calls.filter(n => n === 4).length, 2)
  assert.equal(calls.filter(n => n === 0).length, 1)
  assert.deepEqual(delays, [250])
})

test('persistent abort or short read exhausts four attempts without success', async () => {
  for (const mode of ['abort', 'short']) {
    let calls = 0
    await assert.rejects(verifyArchive({ async downloadToBuffer() {
      calls++
      if (mode === 'short') return Buffer.alloc(0)
      throw Object.assign(new Error('interrupted'), { name: 'AbortError' })
    } }, args, { delay: async () => {} }))
    assert.equal(calls, 4)
  }
})

test('changed ETag and authorization errors are not retried', async () => {
  for (const statusCode of [401, 403, 412]) {
    let calls = 0
    await assert.rejects(verifyArchive({ async downloadToBuffer() {
      calls++; throw Object.assign(new Error('rejected'), { statusCode })
    } }, args, { delay: async () => {} }))
    assert.equal(calls, 1)
  }
})

test('lease loss and incorrect bytes prevent a successful verification', async () => {
  let lost = false, calls = 0
  await assert.rejects(verifyArchive({ async downloadToBuffer(offset, count) {
    calls++; lost = true; return body.subarray(offset, offset + count)
  } }, { ...args, check() { if (lost) throw new Error('Lease lost') } }, { rangeBytes: 4, delay: async () => {} }), /Lease lost/)
  assert.equal(calls, 1)
  await assert.rejects(verifyArchive({ async downloadToBuffer(offset, count) {
    return Buffer.alloc(count, 0)
  } }, args), /verification failed/)
})

test('actual Azure SDK recovers from an interrupted HTTP range while pinning every request', async () => {
  const calls = []
  let dropped = false
  const server = http.createServer((req, res) => {
    assert.equal(req.headers['if-match'], args.etag)
    const range = req.headers['x-ms-range'] || req.headers.range
    const match = /^bytes=(\d+)-(\d+)$/.exec(range)
    assert.ok(match, 'bounded HTTP range required')
    const start = Number(match[1]), end = Number(match[2])
    calls.push(start)
    const data = body.subarray(start, end + 1)
    res.writeHead(206, { 'Content-Length': data.length,
      'Content-Range': 'bytes ' + start + '-' + end + '/' + body.length, ETag: args.etag })
    if (!dropped && start === 4) {
      dropped = true
      res.write(data.subarray(0, 1))
      setImmediate(() => res.destroy())
    } else res.end(data)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const endpoint = 'http://127.0.0.1:' + server.address().port
    const connection = 'DefaultEndpointsProtocol=http;AccountName=testaccount;AccountKey=' +
      Buffer.alloc(32).toString('base64') + ';BlobEndpoint=' + endpoint + '/testaccount;'
    const target = BlobServiceClient.fromConnectionString(connection, { retryOptions: { maxTries: 1 } })
      .getContainerClient('files').getBlobClient('synthetic.tar')
    await verifyArchive(target, args, { rangeBytes: 4, delay: async () => {} })
    assert.equal(calls.filter(n => n === 4).length, 2)
    assert.equal(calls.filter(n => n === 0).length, 1)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
