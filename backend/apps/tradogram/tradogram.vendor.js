// Read-only Intacct vendor resolution. Always scope to the configured site;
// never fall back to the production entity when a site has no entity mapping.
const BASE = 'https://api.intacct.com/ia/api/v1/'

async function findVendor(accountNumber, entityId) {
  const clientId = process.env.SAGE_CLIENT_ID
  const clientSecret = process.env.SAGE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Sage credentials are not configured on the server.')
  const auth = await fetch(BASE + 'oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret,
      username: process.env.SAGE_USERNAME || 'skimWS@GPMC Management Services' }),
    signal: AbortSignal.timeout(20000),
  })
  const authBody = await auth.json().catch(() => null)
  if (!auth.ok || !authBody?.access_token) throw new Error('Unable to authenticate with Sage Intacct. Retry the vendor lookup.')
  const response = await fetch(BASE + 'services/core/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authBody.access_token}`, 'Content-Type': 'application/json', 'X-IA-API-Param-Entity': entityId },
    body: JSON.stringify({ object: 'accounts-payable/vendor', fields: ['key', 'id', 'name', 'status'],
      filters: [{ $eq: { id: accountNumber } }], filterParameters: { caseSensitiveComparison: true, includePrivate: false }, start: 1, size: 2 }),
    signal: AbortSignal.timeout(20000),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(body?.['ia::result'])) throw new Error(`Intacct vendor lookup failed (HTTP ${response.status}). Retry the lookup.`)
  const matches = body['ia::result']
  if (matches.length > 1 || Number(body['ia::meta']?.totalCount) > 1 || body['ia::meta']?.next) {
    return { vendor: null, issue: `Vendor ID ${accountNumber} is not unique in Intacct entity ${entityId}. Resolve the duplicate before proceeding.` }
  }
  const match = matches[0]
  if (!match) return { vendor: null, issue: `No Intacct vendor with ID ${accountNumber} was found in entity ${entityId}. Check the supplier account number in Tradogram.` }
  if (String(match.id) !== accountNumber || !match.key) throw new Error('Intacct returned an unexpected vendor reference. Retry the lookup.')
  const vendor = { id: String(match.id), key: String(match.key), name: String(match.name || ''), status: String(match.status || ''), entityId }
  return { vendor, issue: vendor.status.toLowerCase() === 'active' ? '' : `Intacct vendor ${accountNumber} is not active in entity ${entityId}.` }
}

async function resolveVendor(source, config) {
  const accountNumber = String(source.supplierAccountNumber || '').trim()
  const entityId = String(config?.sageLocationId || '').trim()
  if (!accountNumber) return { vendor: null, issue: 'Set the supplier account number in Tradogram to its Intacct vendor ID, then reload this delivery.' }
  if (!entityId) return { vendor: null, issue: 'Choose a receiving site with a configured Intacct location/entity ID to resolve the vendor.' }
  try { return await findVendor(accountNumber, entityId) } catch (err) {
    // Do not forward upstream bodies or credentials. Network errors get a stable message.
    return { vendor: null, issue: err instanceof TypeError || err.name === 'TimeoutError' || err.name === 'AbortError'
      ? 'Intacct vendor lookup is unavailable. Retry the lookup.' : err.message }
  }
}

module.exports = { resolveVendor }
