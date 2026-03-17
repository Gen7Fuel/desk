import { apiFetch } from './api'

// API utilities for resource kinds CRUD
export async function getResourceKinds() {
  const res = await apiFetch('/api/access/resource-kinds')
  if (!res.ok) throw new Error('Failed to fetch resource kinds')
  return res.json()
}

export async function createResourceKind(data: { name: string }) {
  const res = await apiFetch('/api/access/resource-kinds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create resource kind')
  return res.json()
}

export async function updateResourceKind(id: string, data: { name: string }) {
  const res = await apiFetch(`/api/access/resource-kinds/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update resource kind')
  return res.json()
}

export async function deleteResourceKind(id: string) {
  const res = await apiFetch(`/api/access/resource-kinds/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete resource kind')
  return res.json()
}
