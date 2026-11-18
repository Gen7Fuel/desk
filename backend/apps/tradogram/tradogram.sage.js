const error = (message, status = 502) =>
  Object.assign(new Error(message), { status })

function createSageClient({
  entityId,
  baseUrl = 'https://api.intacct.com/ia/api/v1/',
  clientId,
  clientSecret,
  username = 'skimWS@GPMC Management Services',
  timeoutMs = 20000,
  allowHttp = false,
} = {}) {
  const base = new URL(baseUrl)
  if (
    (!allowHttp && base.protocol !== 'https:') ||
    base.username ||
    base.password ||
    !['A210', 'T010'].includes(entityId)
  )
    throw error('Invalid Intacct connection configuration.', 503)
  let tokenPromise
  async function send(path, body, token) {
    let response
    try {
      response = await fetch(new URL(path, base), {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-IA-API-Param-Entity': entityId,
            }
          : { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: token ? JSON.stringify(body) : body,
      })
    } catch {
      throw error('Could not reach Intacct. Check Intacct before retrying.')
    }
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const failure = error(
        'Intacct rejected the request. Check the vendor, GL accounts, dates and API permissions.',
      )
      failure.safeToRetry = [400, 401, 403, 404, 422].includes(response.status)
      throw failure
    }
    if (!data || data['ia::error'])
      throw error(
        'Intacct returned an unexpected response. Check Intacct before retrying.',
      )
    return data
  }
  function token() {
    if (!clientId || !clientSecret)
      throw error('Sage OAuth2 is not configured on the server.', 503)
    tokenPromise ||= send(
      'oauth2/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        username,
      }),
    ).then((data) => {
      if (!data.access_token) throw error('Intacct authentication failed.')
      return data.access_token
    })
    return tokenPromise
  }
  return {
    async findBill(vendorId, billNumber) {
      const data = await send(
        'services/core/query',
        {
          object: 'accounts-payable/bill',
          fields: ['key', 'billNumber', 'state'],
          filters: [
            { $eq: { 'vendor.id': vendorId } },
            { $eq: { billNumber } },
          ],
          filterExpression: '1 and 2',
          filterParameters: {
            caseSensitiveComparison: false,
            includePrivate: true,
          },
          start: 1,
          size: 2,
        },
        await token(),
      )
      if (!Array.isArray(data['ia::result']))
        throw error('Intacct returned an unexpected bill lookup response.')
      return data['ia::result'][0] || null
    },
    async createBill(payload) {
      if (payload.state !== 'draft')
        throw error('Only draft bill creation is supported.', 400)
      const data = await send(
        'objects/accounts-payable/bill',
        payload,
        await token(),
      )
      const key = data['ia::result']?.key
      if (
        !key ||
        (data['ia::result'].state && data['ia::result'].state !== 'draft')
      )
        throw error(
          'Intacct returned an unexpected bill creation result. Check Intacct before retrying.',
        )
      return String(key)
    },
  }
}
function configuredSage(entityId) {
  return createSageClient({
    entityId,
    clientId: process.env.SAGE_CLIENT_ID,
    clientSecret: process.env.SAGE_CLIENT_SECRET,
    username: process.env.SAGE_USERNAME || 'skimWS@GPMC Management Services',
  })
}
module.exports = { createSageClient, configuredSage }
