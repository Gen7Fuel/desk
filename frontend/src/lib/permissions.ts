/**
 * Decoded permission payload from our JWT.
 */
export interface PermissionPayload {
  email: string
  userId?: string
  role?: string
  permissions: Record<string, Record<string, boolean | Record<string, boolean>>>
  exp?: number
  iat?: number
}

/**
 * Decode a JWT payload without verification (verification is the backend's job).
 */
function decodeToken(token: string): PermissionPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(payload)
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Get the decoded token from localStorage.
 */
export function getTokenPayload(): PermissionPayload | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem('token')
  if (!token) return null
  return decodeToken(token)
}

/**
 * Check whether the current user has a specific permission.
 * @param modulePath – dot-separated path, e.g. "assets.devices"
 * @param action – "create" | "read" | "update" | "delete"
 */
export function can(modulePath: string, action: string): boolean {
  const payload = getTokenPayload()
  if (!payload?.permissions) return false

  const parts = modulePath.split('.')
  let node: unknown = payload.permissions
  for (const p of parts) {
    if (!node || typeof node !== 'object') return false
    node = (node as Record<string, unknown>)[p]
  }
  if (!node || typeof node !== 'object') return false
  return (node as Record<string, boolean>)[action] === true
}
