import { apiFetch } from './api'

// API utilities for device kinds CRUD
export interface DeviceKind {
  _id: string
  name: string
}

export async function getDeviceKinds(): Promise<Array<DeviceKind>> {
  const res = await apiFetch('/api/assets/device-kinds')
  if (!res.ok) throw new Error('Failed to fetch device kinds')
  return res.json()
}

export async function createDeviceKind(data: {
  name: string
}): Promise<DeviceKind> {
  const res = await apiFetch('/api/assets/device-kinds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create device kind')
  return res.json()
}

export async function updateDeviceKind(
  id: string,
  data: { name: string },
): Promise<DeviceKind> {
  const res = await apiFetch(`/api/assets/device-kinds/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update device kind')
  return res.json()
}

export async function deleteDeviceKind(
  id: string,
): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/assets/device-kinds/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete device kind')
  return res.json()
}
