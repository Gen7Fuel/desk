import { apiFetch } from './api'

// API utilities for personnel CRUD
export async function getPersonnel() {
  const res = await apiFetch('/api/personnel')
  if (!res.ok) throw new Error('Failed to fetch personnel')
  return res.json()
}

export async function createPersonnel(data: { name: string; email: string; phone: string }) {
  const res = await apiFetch('/api/personnel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create personnel')
  return res.json()
}

export async function updatePersonnel(id: string, data: Partial<{ name: string; email: string; phone: string }>) {
  const res = await apiFetch(`/api/personnel/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update personnel')
  return res.json()
}

export async function deletePersonnel(id: string) {
  const res = await apiFetch(`/api/personnel/${id}`, {
    method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete personnel')
  return res.json()
}
