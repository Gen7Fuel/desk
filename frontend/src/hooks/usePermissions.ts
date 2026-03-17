import { useCallback, useEffect, useState } from 'react'
import { getTokenPayload } from '../lib/permissions'
import type { PermissionPayload } from '../lib/permissions'

/**
 * React hook that provides permission helpers derived from the JWT in localStorage.
 * Reactively updates when the token changes (login/logout in any tab).
 *
 * Usage:
 *   const { can, permissions, user, refresh } = usePermissions()
 *   if (can('assets.devices', 'delete')) { ... }
 */
export function usePermissions() {
  const [payload, setPayload] = useState<PermissionPayload | null>(() =>
    typeof window !== 'undefined' ? getTokenPayload() : null,
  )

  const refresh = useCallback(() => {
    setPayload(getTokenPayload())
  }, [])

  useEffect(() => {
    // Re-read token when it changes in another tab
    function handleStorage(e: StorageEvent) {
      if (e.key === 'token') refresh()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [refresh])

  const can = useCallback(
    (modulePath: string, action: string): boolean => {
      if (!payload?.permissions) return false
      const parts = modulePath.split('.')
      let node: unknown = payload.permissions
      for (const p of parts) {
        if (!node || typeof node !== 'object') return false
        node = (node as Record<string, unknown>)[p]
      }
      if (!node || typeof node !== 'object') return false
      return (node as Record<string, boolean>)[action] === true
    },
    [payload],
  )

  return {
    /** Check a specific permission — can('assets.devices', 'delete') */
    can,
    /** Re-read the token from localStorage (call after login or role update) */
    refresh,
    /** The full resolved permissions object */
    permissions: payload?.permissions ?? null,
    /** Convenience accessor for user info from the token */
    user: payload
      ? { email: payload.email, role: payload.role, userId: payload.userId }
      : null,
  }
}
