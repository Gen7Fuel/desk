// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { apiFetch } from './api'
import { tradogramRequest } from './tradogram-api'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})
it('sends the Desk bearer token without unrelated browser cookies', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetch)
  localStorage.setItem('token', 'desk-token')
  await apiFetch('/api/tradogram/settings', {
    signal: new AbortController().signal,
    credentials: 'include',
    headers: { 'X-Test': 'preserved' },
  })
  expect(fetch).toHaveBeenCalledWith(
    '/api/tradogram/settings',
    expect.objectContaining({
      credentials: 'omit',
      headers: {
        Authorization: 'Bearer desk-token',
        'Content-Type': 'application/json',
        'X-Test': 'preserved',
      },
      signal: expect.any(AbortSignal),
    }),
  )
})
it('preserves multipart requests without forcing a JSON content type', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetch)
  const body = new FormData()
  await apiFetch('/api/upload', { method: 'POST', body })
  expect(fetch).toHaveBeenCalledWith(
    '/api/upload',
    expect.objectContaining({ body, credentials: 'omit', headers: {} }),
  )
})
it('explains a 431 response even when the parser returns no JSON error body', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 431, ok: false }))
  await expect(tradogramRequest('/settings')).rejects.toThrow(
    'headers are too large',
  )
})
