import { apiFetch } from './api'

export interface CredentialCategory {
  _id: string
  name: string
  createdAt: string
}

export async function getCredentialCategories(): Promise<CredentialCategory[]> {
  const res = await apiFetch('/api/credentials/categories')
  if (!res.ok) throw new Error('Failed to fetch credential categories')
  return res.json()
}

export async function createCredentialCategory(data: { name: string }): Promise<CredentialCategory> {
  const res = await apiFetch('/api/credentials/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || 'Failed to create category')
  }
  return res.json()
}

export async function updateCredentialCategory(
  id: string,
  data: { name: string },
): Promise<CredentialCategory> {
  const res = await apiFetch(`/api/credentials/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || 'Failed to update category')
  }
  return res.json()
}

export async function deleteCredentialCategory(id: string): Promise<void> {
  const res = await apiFetch(`/api/credentials/categories/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || 'Failed to delete category')
  }
}
