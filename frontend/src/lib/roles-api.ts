import { apiFetch } from './api'

export interface Role {
  _id: string
  name: string
  description: string
  permissions: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface PermissionManifest {
  version: number
  modules: Record<
    string,
    {
      actions?: Array<string>
      submodules?: Record<string, { actions: Array<string> }>
    }
  >
}

export async function getRoles(): Promise<Array<Role>> {
  const res = await apiFetch('/api/roles')
  if (!res.ok) throw new Error('Failed to fetch roles.')
  return res.json()
}

export async function getPermissionManifest(): Promise<PermissionManifest> {
  const res = await apiFetch('/api/roles/manifest')
  if (!res.ok) throw new Error('Failed to fetch permission manifest.')
  return res.json()
}

export async function createRole(data: {
  name: string
  description?: string
  permissions: Record<string, unknown>
}): Promise<Role> {
  const res = await apiFetch('/api/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? 'Failed to create role.')
  }
  return res.json()
}

export async function updateRole(
  id: string,
  data: { name?: string; description?: string; permissions?: Record<string, unknown> },
): Promise<Role> {
  const res = await apiFetch(`/api/roles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? 'Failed to update role.')
  }
  return res.json()
}

export async function deleteRole(id: string): Promise<void> {
  const res = await apiFetch(`/api/roles/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete role.')
}
