import { getExternalToken } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'
import { SITE_BANK_ACCOUNTS } from '@/lib/sage-bank-accounts'

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

/**
 * Looks up the GL account behind a site's Sage bank (checking) account, e.g.
 * Couchiching -> "10131". Returns null when the site has no bank account
 * configured or the account has no GL account on it.
 */
export async function resolveSiteBankGlAccount(
  sageToken: string,
  entityId: string,
  site: string,
): Promise<string | null> {
  const bankAccountId = SITE_BANK_ACCOUNTS[site]
  if (!bankAccountId) return null

  const res = await apiFetch(
    `/api/sage/checking-account/${encodeURIComponent(bankAccountId)}`,
    { headers: { 'X-Sage-Token': sageToken, 'X-Sage-Entity': entityId } },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const detail =
      (body['ia::error'] as { message?: string } | undefined)?.message ??
      (body.message as string | undefined) ??
      JSON.stringify(body)
    throw new Error(
      `Failed to fetch Sage bank account "${bankAccountId}" (${res.status}): ${detail}`,
    )
  }
  const data = (await res.json()) as {
    'ia::result'?: { glAccount?: { id?: string } }
  }
  return data['ia::result']?.glAccount?.id ?? null
}
