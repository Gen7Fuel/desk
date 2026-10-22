// Company scope for the integration, independent of construction sites.
function getSettings() {
  const entityId = (process.env.TRADOGRAM_SAGE_ENTITY_ID || 'T010').trim()
  if (!['T010', 'A210'].includes(entityId)) throw new Error('TRADOGRAM_SAGE_ENTITY_ID must be T010 (test) or A210 (Gen7 LP).')
  return { entityId, company: entityId === 'T010' ? 'Test company' : 'Gen7 LP', environment: entityId === 'T010' ? 'test' : 'production' }
}
module.exports = { getSettings }
