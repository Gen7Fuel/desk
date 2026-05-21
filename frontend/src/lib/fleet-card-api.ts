import { getTokenPayload } from './permissions'

const HUB = 'https://app.gen7fuel.com'

function getExternalToken(): string {
  const payload = getTokenPayload() as
    | (ReturnType<typeof getTokenPayload> & { externalToken?: string })
    | null
  return payload?.externalToken ?? ''
}

async function hubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getExternalToken()}`,
    ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string> | undefined),
  }
  return fetch(HUB + path, { ...init, headers })
}

export interface FleetCard {
  _id: string
  fleetCardNumber: string
  customerName: string
  driverName: string
  vehicleMakeModel: string
  numberPlate: string
  status: 'active' | 'inactive' | 'lost' | 'stolen' | 'cancelled'
  notes: string
  customerId?: string
  customerEmail?: string
}

export type FleetCardStatus = FleetCard['status']

export const FLEET_CARD_STATUSES: Array<FleetCardStatus> = [
  'active',
  'inactive',
  'lost',
  'stolen',
  'cancelled',
]

export function formatCardNumber(raw: string): string {
  return raw.replace(/(\d{4})(?=\d)/g, '$1 ')
}

export async function getFleetCards(): Promise<Array<FleetCard>> {
  const res = await hubFetch('/api/fleet')
  if (!res.ok) throw new Error('Failed to fetch fleet cards')
  return res.json()
}

export async function createFleetCard(
  data: Omit<FleetCard, '_id' | 'customerId' | 'customerEmail'>,
): Promise<FleetCard> {
  const res = await hubFetch('/api/fleet', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Failed to create fleet card')
  return body
}

export async function updateFleetCard(
  id: string,
  data: Partial<Omit<FleetCard, '_id' | 'customerId' | 'customerEmail'>>,
): Promise<FleetCard> {
  const res = await hubFetch(`/api/fleet/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Failed to update fleet card')
  return body
}

export async function deleteFleetCard(id: string): Promise<void> {
  const res = await hubFetch(`/api/fleet/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Failed to delete fleet card')
  }
}
