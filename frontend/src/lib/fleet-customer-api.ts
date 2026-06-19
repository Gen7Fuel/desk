import { getTokenPayload } from './permissions'

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
    Authorization: `Bearer ${getExternalToken()}`,
    ...(init.body instanceof FormData
      ? {}
      : { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string> | undefined),
  }
  return fetch(HUB + path, { ...init, headers })
}

export interface FleetCustomer {
  _id: string
  name: string
  email: string
  username?: string
  password?: string
  createdAt: string
  updatedAt: string
}

export async function getFleetCustomers(): Promise<Array<FleetCustomer>> {
  const res = await hubFetch('/api/fleet-customers')
  if (!res.ok) throw new Error('Failed to fetch fleet customers')
  return res.json()
}

export async function createFleetCustomer(data: {
  name: string
  email: string
}): Promise<FleetCustomer> {
  const res = await hubFetch('/api/fleet-customers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok)
    throw new Error(
      (body as { message?: string }).message ??
        'Failed to create fleet customer',
    )
  return body
}

export async function updateFleetCustomer(
  id: string,
  data: { name: string; email: string },
): Promise<FleetCustomer> {
  const res = await hubFetch(`/api/fleet-customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok)
    throw new Error(
      (body as { message?: string }).message ??
        'Failed to update fleet customer',
    )
  return body
}

export async function setFleetCustomerCredentials(
  id: string,
  data: { username: string; password: string },
): Promise<FleetCustomer> {
  const res = await hubFetch(`/api/fleet-customers/${id}/credentials`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok)
    throw new Error(
      (body as { message?: string }).message ?? 'Failed to set credentials',
    )
  return body
}

export async function revokeFleetCustomerAccess(
  id: string,
): Promise<FleetCustomer> {
  const res = await hubFetch(`/api/fleet-customers/${id}/revoke-credentials`, {
    method: 'PATCH',
  })
  const body = await res.json()
  if (!res.ok)
    throw new Error(
      (body as { message?: string }).message ?? 'Failed to revoke access',
    )
  return body
}
