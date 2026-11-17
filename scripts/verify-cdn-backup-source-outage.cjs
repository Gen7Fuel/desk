const assert = require('node:assert/strict')
const { BlobServiceClient } = require('../backend/node_modules/@azure/storage-blob')
const { tick, ROOT } = require('../backend/apps/cdn/cdn.backup')
const endpoint = process.env.CDN_BACKUP_SIMULATION_URL
if (!endpoint || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(endpoint)) throw new Error('Set a localhost CDN_BACKUP_SIMULATION_URL')
const connection = 'DefaultEndpointsProtocol=http;AccountName=testaccount;AccountKey=' + Buffer.alloc(32).toString('base64') + ';BlobEndpoint=' + endpoint + '/azure/testaccount;'
const source = BlobServiceClient.fromConnectionString(connection, { retryOptions: { maxTries: 1 } }).getContainerClient('files')
const lastSuccess = { source: 'legacy', completedAt: '2026-11-16T08:00:00Z' }
const blobs = new Map([[`${ROOT}status.json`, { lastSuccess }]])
const destination = {
  url: 'https://original.example/hub',
  async *listBlobsFlat() {},
  getBlockBlobClient(name) {
    return {
      async downloadToBuffer() { return Buffer.from(JSON.stringify(blobs.get(name))) },
      async uploadData(bytes, options) {
        if (options?.conditions?.ifNoneMatch && blobs.has(name)) throw Object.assign(new Error('exists'), { statusCode: 412 })
        blobs.set(name, JSON.parse(bytes.toString()))
      },
      getBlobLeaseClient() { return { leaseId: 'test-lease', async acquireLease() {}, async renewLease() {}, async releaseLease() {} } },
    }
  },
}
async function main() {
  await assert.rejects(tick(destination, new Date('2026-11-17T08:00:00Z'), source), err => err.statusCode === 503)
  const state = blobs.get(`${ROOT}status.json`)
  assert.equal(state.current.phase, 'failed')
  assert.deepEqual(state.lastSuccess, lastSuccess)
  assert.equal(blobs.size, 1)
  console.log('PASS: real SDK source-list outage retained prior success and published no archive')
}
main().catch(() => { console.error('Source outage check failed'); process.exitCode = 1 })
