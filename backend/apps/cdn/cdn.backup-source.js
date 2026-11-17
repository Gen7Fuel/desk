const { BlobServiceClient } = require('@azure/storage-blob')

// Only the live CDN reader changes. Archives, queue, lease and retention keep
// using the original shared storage connection string in cdn.backup.js.
function sourceContainer(legacy) {
  const names = ['ACCOUNT', 'CONTAINER', 'TENANT_ID', 'CLIENT_ID', 'CLIENT_SECRET']
  const values = names.map(name => process.env[`CDN_BACKUP_SOURCE_${name}`] || '')
  if (values.every(value => !value)) return legacy
  if (values.some(value => !value.trim())) {
    throw new Error('Configure all five CDN_BACKUP_SOURCE settings or leave all unset')
  }
  const [account, container, tenant, client, secret] = values
  if (!/^[a-z0-9]{3,24}$/.test(account) || !/^(?!.*--)[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(container)) {
    throw new Error('Invalid CDN backup source account or container name')
  }
  const { ClientSecretCredential } = require('@azure/identity')
  const credential = new ClientSecretCredential(tenant, client, secret)
  return new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential).getContainerClient(container)
}

function sourceId(source) {
  // Azure SDK container URL has no credentials with either supported auth mode.
  // Strip query defensively so provenance never records a SAS token.
  return source.url ? source.url.split('?')[0].replace(/\/$/, '') : 'legacy'
}

module.exports = { sourceContainer, sourceId }
