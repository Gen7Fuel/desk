const express = require('express')
const router = express.Router()
const { authenticate, requirePermission } = require('../../middleware/auth')
const { saveStationNarrative, getStationNarrative, getStationNarratives } = require('./narrative.sql')

const PERM = 'reports.narrative'

router.post('/narrative', authenticate, requirePermission(PERM, 'create'), async (req, res) => {
  try {
    const { csoCode, legalName, reportDate, narrativeText, suggestion } = req.body
    if (!csoCode || !legalName || !reportDate || !narrativeText?.trim()) {
      return res.status(400).json({ error: 'csoCode, legalName, reportDate, and narrativeText are required.' })
    }
    await saveStationNarrative(csoCode, legalName, reportDate, narrativeText, suggestion)
    res.json({ message: 'Narrative saved successfully.' })
  } catch (err) {
    console.error('Error saving narrative:', err)
    res.status(500).json({ error: err.message || 'Internal server error.', code: err.code, name: err.name })
  }
})

router.get('/narrative/:csoCode', authenticate, requirePermission(PERM, 'read'), async (req, res) => {
  try {
    const { csoCode } = req.params
    const records = await getStationNarratives(csoCode)
    res.json(records)
  } catch (err) {
    console.error('Error fetching narratives:', err)
    res.status(500).json({ error: err.message || 'Internal server error.', code: err.code, name: err.name })
  }
})

router.get('/narrative/:csoCode/:date', authenticate, requirePermission(PERM, 'read'), async (req, res) => {
  try {
    const { csoCode, date } = req.params
    const record = await getStationNarrative(csoCode, date)
    res.json(record)
  } catch (err) {
    console.error('Error fetching narrative:', err)
    res.status(500).json({ error: err.message || 'Internal server error.', code: err.code, name: err.name })
  }
})

module.exports = router
