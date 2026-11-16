const assert = require('node:assert/strict')
const { BlobServiceClient } = require('../backend/node_modules/@azure/storage-blob')
const { tick } = require('../backend/apps/cdn/cdn.backup')
const endpoint = process.env.CDN_BACKUP_SIMULATION_URL
if (!endpoint) throw new Error('Set CDN_BACKUP_SIMULATION_URL to the running Postman simulation')
const connection = 'DefaultEndpointsProtocol=http;AccountName=testaccount;AccountKey=' + Buffer.alloc(32).toString('base64') + ';BlobEndpoint=' + endpoint + '/azure/testaccount;'
const c = BlobServiceClient.fromConnectionString(connection, { retryOptions: { maxTries: 1 } }).getContainerClient('files')
assert.rejects(tick(c), err => err.statusCode === 503).then(() => console.log('PASS: real SDK received storage outage; no successful backup was published')).catch(() => { console.error('Outage check failed'); process.exitCode = 1 })
