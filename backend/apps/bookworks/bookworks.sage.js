const BASE = 'https://api.intacct.com/ia/api/v1/'
const ENTITY = 'A210'
const error = (message, status = 502) => Object.assign(new Error(message), { status })

function createSageClient({ baseUrl = BASE, clientId, clientSecret, username = 'skimWS@GPMC Management Services', timeoutMs = 20000, allowHttp = false } = {}) {
  const base = new URL(baseUrl)
  if ((!allowHttp && base.protocol !== 'https:') || base.username || base.password) throw error('Invalid Intacct connection configuration.', 503)
  let tokenPromise
  async function send(path, body, token) {
    let response
    try {
      response = await fetch(new URL(path, base), {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-IA-API-Param-Entity': ENTITY } : { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: token ? JSON.stringify(body) : body,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        const err = error('Intacct rejected the request. Check the vendor, accounts, dates, and connection permissions.')
        // An explicit validation rejection establishes that no bill was created.
        err.safeToRetry = [400, 401, 403, 404, 422].includes(response.status)
        throw err
      }
      if (!data) throw error('Intacct returned an unexpected response.')
      return data
    } catch (err) {
      if (err.status) throw err
      throw error(err.name === 'TimeoutError' || err.name === 'AbortError'
        ? 'Intacct timed out. Check Intacct before retrying.' : 'Could not reach Intacct. Check Intacct before retrying.')
    }
  }
  function token() {
    if (!clientId || !clientSecret) throw error('Sage OAuth2 is not configured on the server.', 503)
    tokenPromise ||= send('oauth2/token', new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, username }))
      .then(data => { if (!data.access_token) throw error('Intacct authentication failed.'); return data.access_token })
    return tokenPromise
  }
  async function query(object, fields, filters, size = 25) {
    const data = await send('services/core/query', {
      object, fields, filters, filterExpression: filters.map((_, i) => i + 1).join(' and '),
      filterParameters: { caseSensitiveComparison: false, includePrivate: true }, orderBy: [{ key: 'asc' }], start: 1, size,
    }, await token())
    if (!Array.isArray(data['ia::result'])) throw error('Intacct returned an unexpected query response.')
    return { rows: data['ia::result'], meta: data['ia::meta'] || {} }
  }
  async function getVendor(id) {
    const { rows, meta } = await query('accounts-payable/vendor', ['key', 'id', 'name', 'status'], [{ $eq: { id } }], 2)
    if (rows.length !== 1 || meta.next || Number(meta.totalCount) > 1 || rows[0].id !== id || rows[0].status !== 'active' || !rows[0].key) {
      throw error('Select an active, uniquely identified Intacct vendor in A210.', 400)
    }
    return { id: rows[0].id, key: String(rows[0].key), name: String(rows[0].name || ''), entityId: ENTITY }
  }
  return {
    getVendor,
    async searchVendors(q) {
      const { rows, meta } = await query('accounts-payable/vendor', ['key', 'id', 'name'], [{ $eq: { status: 'active' } }, { $contains: { name: q } }])
      return { vendors: rows.map(v => ({ id: String(v.id), key: String(v.key), name: String(v.name || '') })), hasMore: Boolean(meta.next) }
    },
    async findBill(vendorId, billNumber) {
      const { rows } = await query('accounts-payable/bill', ['key', 'billNumber', 'state'], [{ $eq: { 'vendor.id': vendorId } }, { $eq: { billNumber } }], 2)
      return rows[0] || null
    },
    async createBill(payload) {
      const auth = await token()
      const data = await send('objects/accounts-payable/bill', payload, auth)
      const key = data['ia::result']?.key
      if (!key) throw error('Intacct did not return a bill key. Check Intacct before retrying.')
      return String(key)
    },
  }
}

function configuredSage() {
  return createSageClient({ clientId: process.env.SAGE_CLIENT_ID, clientSecret: process.env.SAGE_CLIENT_SECRET,
    username: process.env.SAGE_USERNAME || 'skimWS@GPMC Management Services' })
}

module.exports = { createSageClient, configuredSage, ENTITY }
