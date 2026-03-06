const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')

const SAGE_BASE = 'https://api.intacct.com/ia/api/v1/'

/**
 * GET /sage/authorize
 * Redirects the browser to the Sage Intacct OAuth2 authorization page.
 * The frontend navigates here directly (window.location).
 * Token is passed as ?token= query param since browser redirects can't send headers.
 */
router.get('/authorize', (req, res, next) => {
  // Accept JWT from query string since this is a full-page browser redirect
  if (req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`
  }
  next()
}, authenticate, (_req, res) => {
  const clientId = process.env.SAGE_CLIENT_ID
  const callbackUrl = process.env.SAGE_CALLBACK_URL

  if (!clientId || !callbackUrl) {
    return res.status(500).json({ message: 'Sage OAuth2 is not configured on the server.' })
  }

  // Generate a random state value for CSRF protection
  const state = Math.random().toString(36).substring(2, 15)

  const authorizeUrl =
    SAGE_BASE +
    'oauth2/authorize?' +
    `state=${state}` +
    `&response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}`

  return res.redirect(authorizeUrl)
})

/**
 * POST /sage/token
 * Exchanges the authorization code for an access token.
 * Called by the frontend callback page with { code }.
 */
router.post('/token', authenticate, async (req, res) => {
  try {
    const { code } = req.body
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required.' })
    }

    const clientId = process.env.SAGE_CLIENT_ID
    const clientSecret = process.env.SAGE_CLIENT_SECRET
    const callbackUrl = process.env.SAGE_CALLBACK_URL

    if (!clientId || !clientSecret || !callbackUrl) {
      return res.status(500).json({ message: 'Sage OAuth2 is not configured on the server.' })
    }

    const tokenUrl = SAGE_BASE + 'oauth2/token'

    // Build URL-encoded form body matching the Sage demo
    const body = new URLSearchParams()
    body.append('grant_type', 'authorization_code')
    body.append('code', code)
    body.append('redirect_uri', callbackUrl)
    body.append('client_id', clientId)
    body.append('client_secret', clientSecret)

    const response = await fetch(tokenUrl, {
      method: 'POST',
      body,
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[sage/token] Sage token exchange failed:', response.status, text)
      return res.status(response.status).json({
        message: 'Failed to exchange authorization code.',
        detail: text,
      })
    }

    const data = await response.json()
    const accessToken = data.access_token

    if (!accessToken) {
      console.error('[sage/token] No access_token in response:', data)
      return res.status(502).json({ message: 'No access token returned by Sage.' })
    }

    return res.json({ access_token: accessToken })
  } catch (err) {
    console.error('[sage/token] error:', err)
    return res.status(500).json({ message: 'Token exchange failed.' })
  }
})

module.exports = router
