/**
 * Wraps fetch with automatic Authorization header injection from localStorage.
 * Use this instead of raw fetch for all authenticated API calls.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('token')
  const isFormData = init.body instanceof FormData
  return fetch(input, {
    ...init,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
