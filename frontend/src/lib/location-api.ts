import { apiFetch } from './api'

// API utilities for location CRUD
export async function getLocations() {
  const res = await apiFetch('/api/assets/locations')
  if (!res.ok) throw new Error('Failed to fetch locations')
  return res.json()
}

export async function createLocation(data: {
  name: string
  lat: number
  lng: number
}) {
  const res = await apiFetch('/api/assets/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to create location')
  }
  return res.json()
}

export async function updateLocation(
  id: string,
  data: Partial<{ name: string; lat: number; lng: number }>,
) {
  const res = await apiFetch(`/api/assets/locations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to update location')
  }
  return res.json()
}

export async function deleteLocation(id: string) {
  const res = await apiFetch(`/api/assets/locations/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete location')
  return res.json()
}
