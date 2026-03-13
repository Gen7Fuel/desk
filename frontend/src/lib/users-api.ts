import { apiFetch } from './api'

export interface User {
  _id: string
  email: string
  role: string | null
  permissionOverrides: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export async function getUsers(): Promise<Array<User>> {
  const res = await apiFetch('/api/users')
  if (!res.ok) throw new Error('Failed to fetch users.')
  return res.json()
}

export async function createUser(data: { email: string; role?: string | null }): Promise<User> {
  const res = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? 'Failed to create user.')
  }
  return res.json()
}

export async function updateUser(
  id: string,
  data: { role?: string | null; permissionOverrides?: Record<string, unknown> },
): Promise<User> {
  const res = await apiFetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? 'Failed to update user.')
  }
  return res.json()
}

export async function deleteUser(id: string): Promise<void> {
  const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete user.')
}
