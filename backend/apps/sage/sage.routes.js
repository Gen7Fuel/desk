const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')

const SAGE_BASE = 'https://api.intacct.com/ia/api/v1/'
const LOCATION_ID = 'A210'

/**
 * POST /sage/connect
 * Obtains an access token using the client_credentials grant.
 * No browser redirect or callback — returns { access_token } directly.
 */
router.post('/connect', authenticate, async (_req, res) => {
  try {
    const clientId = process.env.SAGE_CLIENT_ID
    const clientSecret = process.env.SAGE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return res.status(500).json({ message: 'Sage OAuth2 is not configured on the server.' })
    }

    const tokenUrl = SAGE_BASE + 'oauth2/token'

    const body = new URLSearchParams()
    body.append('grant_type', 'client_credentials')
    body.append('client_id', clientId)
    body.append('client_secret', clientSecret)
    body.append('username', 'skimWS@GPMC Management Services')

    const response = await fetch(tokenUrl, {
      method: 'POST',
      body,
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[sage/connect] Sage token request failed:', response.status, text)
      return res.status(response.status).json({
        message: 'Failed to obtain Sage access token.',
        detail: text,
      })
    }

    const data = await response.json()
    const accessToken = data.access_token

    if (!accessToken) {
      console.error('[sage/connect] No access_token in response:', data)
      return res.status(502).json({ message: 'No access token returned by Sage.' })
    }

    return res.json({ access_token: accessToken })
  } catch (err) {
    console.error('[sage/connect] error:', err)
    return res.status(500).json({ message: 'Sage connection failed.' })
  }
})

/**
 * POST /sage/attachment
 * Proxies a create-attachment request to the Sage Intacct API.
 * Expects the Sage access token in the X-Sage-Token request header.
 */
router.post('/attachment', authenticate, async (req, res) => {
  try {
    const sageToken = req.headers['x-sage-token']
    if (!sageToken) {
      return res.status(400).json({ message: 'Missing X-Sage-Token header.' })
    }

    const url = SAGE_BASE + 'objects/company-config/attachment'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sageToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      console.error('[sage/attachment] Sage error:', response.status, JSON.stringify(data, null, 2))
      return res.status(response.status).json(
        data ?? { message: `Sage returned ${response.status}` }
      )
    }

    return res.status(response.status).json(data)
  } catch (err) {
    console.error('[sage/attachment] error:', err)
    return res.status(500).json({ message: 'Sage attachment request failed.' })
  }
})

/**
 * POST /sage/bill
 * Proxies a create-bill request to the Sage Intacct AP API.
 * Expects the Sage access token in the X-Sage-Token request header.
 */
router.post('/bill', authenticate, async (req, res) => {
  try {
    const sageToken = req.headers['x-sage-token']
    if (!sageToken) {
      return res.status(400).json({ message: 'Missing X-Sage-Token header.' })
    }

    const url = SAGE_BASE + 'objects/accounts-payable/bill'
    console.log('[sage/bill] payload:', JSON.stringify(req.body, null, 2))
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sageToken}`,
        'Content-Type': 'application/json',
        'X-IA-API-Param-Entity': LOCATION_ID,
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      console.error('[sage/bill] Sage error:', response.status, JSON.stringify(data, null, 2))
      return res.status(response.status).json(
        data ?? { message: `Sage returned ${response.status}` }
      )
    }

    return res.status(response.status).json(data)
  } catch (err) {
    console.error('[sage/bill] error:', err)
    return res.status(500).json({ message: 'Sage bill request failed.' })
  }
})

/**
 * POST /sage/invoice
 * Proxies a create-invoice request to the Sage Intacct AR API.
 * Expects the Sage access token in the X-Sage-Token request header.
 */
router.post('/invoice', authenticate, async (req, res) => {
  try {
    const sageToken = req.headers['x-sage-token']
    if (!sageToken) {
      return res.status(400).json({ message: 'Missing X-Sage-Token header.' })
    }

    const url = SAGE_BASE + 'objects/accounts-receivable/invoice'
    console.log('[sage/invoice] payload:', JSON.stringify(req.body, null, 2))
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sageToken}`,
        'Content-Type': 'application/json',
        'X-IA-API-Param-Entity': LOCATION_ID,
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      console.error('[sage/invoice] Sage error:', response.status, JSON.stringify(data, null, 2))
      return res.status(response.status).json(
        data ?? { message: `Sage returned ${response.status}` }
      )
    }

    return res.status(response.status).json(data)
  } catch (err) {
    console.error('[sage/invoice] error:', err)
    return res.status(500).json({ message: 'Sage invoice request failed.' })
  }
})

module.exports = router
