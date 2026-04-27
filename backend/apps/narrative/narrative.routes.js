const express = require('express')
const router = express.Router()
const { authenticate, requirePermission } = require('../../middleware/auth')
const { saveStationNarrative, getStationNarrative } = require('./narrative.sql')

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
    res.status(500).json({ error: 'Internal server error.' })
  }
})

router.get('/narrative/:csoCode/:date', authenticate, requirePermission(PERM, 'read'), async (req, res) => {
  try {
    const { csoCode, date } = req.params
    const record = await getStationNarrative(csoCode, date)
    res.json(record)
  } catch (err) {
    console.error('Error fetching narrative:', err)
    res.status(500).json({ error: 'Internal server error.' })
  }
})

module.exports = router
