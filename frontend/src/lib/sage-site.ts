import { getExternalToken } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'

const HUB = 'https://app.gen7fuel.com'

export async function getSageToken(): Promise<string> {
  const tokenRes = await apiFetch('/api/sage/connect', { method: 'POST' })
  if (!tokenRes.ok) throw new Error('Failed to get Sage token')
  const { access_token: sageToken } = (await tokenRes.json()) as {
    access_token: string
  }
  return sageToken
}

/** Resolves a Hub site to its Sage location/entity ID (e.g. "G160"). */
export async function resolveSiteEntity(
  sageToken: string,
  site: string,
): Promise<string> {
  const locRes = await fetch(`${HUB}/api/locations`, {
    headers: { Authorization: `Bearer ${getExternalToken()}` },
  })
  if (!locRes.ok) throw new Error('Failed to fetch Hub locations')
  const locations = (await locRes.json()) as Array<{
    stationName: string
    site?: string
    sageEntityKey?: string
  }>
  const loc = locations.find((l) => (l.site ?? l.stationName) === site)
  if (!loc?.sageEntityKey)
    throw new Error(`No Sage entity key configured for "${site}"`)

  const entityRes = await apiFetch(`/api/sage/entity/${loc.sageEntityKey}`, {
    headers: { 'X-Sage-Token': sageToken },
  })
  if (!entityRes.ok) throw new Error('Failed to fetch Sage entity')
  const entityData = (await entityRes.json()) as {
    'ia::result': { id: string }
  }
  const locationId = entityData['ia::result'].id
  if (!locationId) throw new Error('Could not resolve Sage location ID')
  return locationId
}
