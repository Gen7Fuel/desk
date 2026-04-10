import { io } from 'socket.io-client'
import { getExternalToken } from './permissions'
import type { Socket } from 'socket.io-client';

const HUB_ORIGIN = 'https://app.gen7fuel.com'
const SUPPORT_NAMESPACE = '/support'

let supportSocket: Socket | null = null

/**
 * Get (or create) a singleton socket.io connection to The Hub's /support
 * namespace. Authenticates with the Hub JWT embedded in the Desk token.
 */
export function getHubSupportSocket(): Socket {
  // Return existing socket if it's connected or still connecting
  if (supportSocket && (supportSocket.connected || supportSocket.active)) return supportSocket

  if (supportSocket) {
    supportSocket.disconnect()
    supportSocket = null
  }

  const token = getExternalToken()

  supportSocket = io(`${HUB_ORIGIN}${SUPPORT_NAMESPACE}`, {
    path: '/socket.io/',
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    timeout: 20000,
  })

  supportSocket.on('connect', () => {
    console.log('[HubSocket] Connected to Hub /support namespace')
  })

  supportSocket.on('disconnect', (reason) => {
    console.log('[HubSocket] Disconnected:', reason)
  })

  supportSocket.on('connect_error', (err) => {
    console.error('[HubSocket] Connection error:', err.message)
  })

  return supportSocket
}

export function disconnectHubSupportSocket() {
  if (supportSocket) {
    supportSocket.disconnect()
    supportSocket = null
  }
}
