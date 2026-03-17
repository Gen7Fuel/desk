import { apiFetch } from './api'

export interface Credential {
  _id: string
  name: string
  category: string
  url?: string
  username: string
  password: string
  notes?: string
  createdAt: string
}

export async function getCredentials(): Promise<Array<Credential>> {
  const res = await apiFetch('/api/credentials')
  if (!res.ok) throw new Error('Failed to fetch credentials')
  return res.json()
}

export async function createCredential(data: {
  name: string
  category: string
  url?: string
  username: string
  password: string
  notes?: string
}): Promise<Credential> {
  const res = await apiFetch('/api/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error || 'Failed to create credential',
    )
  }
  return res.json()
}

export async function updateCredential(
  id: string,
  data: Partial<{
    name: string
    category: string
    url: string
    username: string
    password: string
    notes: string
  }>,
): Promise<Credential> {
  const res = await apiFetch(`/api/credentials/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error || 'Failed to update credential',
    )
  }
  return res.json()
}

export async function deleteCredential(id: string): Promise<void> {
  const res = await apiFetch(`/api/credentials/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error || 'Failed to delete credential',
    )
  }
}
