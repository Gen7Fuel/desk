import { apiFetch } from './api'

// Utility for lock/unlock API requests
export async function lockText(
  text: string,
): Promise<{ id: string; key: string }> {
  const res = await apiFetch('/api/encrypt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Encryption failed')
  return res.json()
}

export async function unlockText(
  id: string,
  key: string,
): Promise<{ text: string }> {
  const res = await apiFetch('/api/decrypt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, key }),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Decryption failed')
  return res.json()
}
