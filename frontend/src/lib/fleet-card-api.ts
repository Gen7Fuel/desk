import { apiFetch } from './api'

export interface FleetCard {
  _id: string
  cardNumber: string
  accountName: string
  driverName: string
  numberPlate: string
  makeModel: string
  status: 'active' | 'inactive' | 'lost' | 'cancelled'
  notes: string
  createdAt: string
  updatedAt: string
}

export type FleetCardStatus = FleetCard['status']

export const FLEET_CARD_STATUSES: Array<FleetCardStatus> = [
  'active',
  'inactive',
  'lost',
  'cancelled',
]

export function formatCardNumber(raw: string): string {
  return raw.replace(/(\d{4})(?=\d)/g, '$1 ')
}

export async function getFleetCards(): Promise<Array<FleetCard>> {
  const res = await apiFetch('/api/fleet-cards')
  if (!res.ok) throw new Error('Failed to fetch fleet cards')
  return res.json()
}

export async function createFleetCard(
  data: Omit<FleetCard, '_id' | 'createdAt' | 'updatedAt'>,
): Promise<FleetCard> {
  const res = await apiFetch('/api/fleet-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Failed to create fleet card')
  return body
}

export async function updateFleetCard(
  id: string,
  data: Partial<Omit<FleetCard, '_id' | 'createdAt' | 'updatedAt'>>,
): Promise<FleetCard> {
  const res = await apiFetch(`/api/fleet-cards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Failed to update fleet card')
  return body
}

export async function deleteFleetCard(id: string): Promise<void> {
  const res = await apiFetch(`/api/fleet-cards/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? 'Failed to delete fleet card')
  }
}
