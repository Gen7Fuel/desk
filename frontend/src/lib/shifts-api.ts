import { getTokenPayload } from '@/lib/permissions'

const HUB = 'https://app.gen7fuel.com'

function getExternalToken(): string {
  const payload = getTokenPayload() as { externalToken?: string } | null
  return payload?.externalToken ?? ''
}

async function hubFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getExternalToken()}`,
    ...(init.headers as Record<string, string> | undefined),
  }
  return fetch(HUB + path, { ...init, headers })
}

// Cash summary ("shift") records in Hub's cashsummaries collection. Most of
// the ~60 fields on this collection are populated automatically every few
// hours by Hub's SFT ingestion cron — the fields below are the subset the
// cron never touches, so a manual edit here persists.
export interface Shift {
  _id: string
  site: string
  shift_number: string
  date: string
  canadian_cash_collected?: number
  cash_back?: number
  loyalty?: number
  exempted_tax?: number
  chequesCashedOut?: number
  pinpadTotal?: number
  // Read-only: Hub's cron may flag a shift as Chicken Delight, which
  // repurposes exempted_tax/chequesCashedOut/pinpadTotal on Hub's side and
  // can't be un-set through the update route. Shifts flagged this way are
  // shown read-only rather than edited here.
  isChickenDelight?: boolean
  createdAt?: string
  updatedAt?: string
}

// canadian_cash_collected is deliberately required (not optional): Hub's
// PUT /:id has no fallback-to-existing-value for this one field, unlike
// every other field here, so it must always be sent explicitly or a save
// will wipe it out.
export interface ShiftInput {
  site: string
  shift_number: string
  date: string
  canadian_cash_collected: number
  cash_back?: number
  loyalty?: number
  exempted_tax?: number
  chequesCashedOut?: number
  pinpadTotal?: number
}

export async function listShifts(site: string): Promise<Array<Shift>> {
  const res = await hubFetch(
    `/api/cash-summary?site=${encodeURIComponent(site)}`,
  )
  if (!res.ok) throw new Error('Failed to fetch shifts')
  return res.json()
}

export async function createShift(data: ShiftInput): Promise<Shift> {
  const res = await hubFetch('/api/cash-summary', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok)
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to create shift',
    )
  return body
}

export async function updateShift(
  id: string,
  data: ShiftInput,
): Promise<Shift> {
  const res = await hubFetch(`/api/cash-summary/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok)
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to update shift',
    )
  return body
}
