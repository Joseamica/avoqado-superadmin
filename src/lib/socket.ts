import { io, type Socket } from 'socket.io-client'

/**
 * Socket.IO client compartido. Lazy: sólo conecta cuando alguien llama
 * connectSocket() (típicamente desde el hook useRealtimeInvalidation
 * cuando hay sesión activa). El backend autentica vía la misma cookie HTTP-only
 * que usa el API REST — por eso withCredentials: true.
 */

let socket: Socket | null = null

function resolveSocketUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL?.trim()
  if (!apiUrl) return 'http://localhost:3000'
  // El API base suele venir con `/api/v1` al final. Para Socket.IO necesitamos el host raíz.
  return apiUrl.replace(/\/api\/v\d+\/?$/i, '')
}

export function connectSocket(): Socket {
  if (socket && socket.connected) return socket
  if (socket) {
    socket.connect()
    return socket
  }

  socket = io(resolveSocketUrl(), {
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 8_000,
    transports: ['websocket', 'polling'],
  })

  if (import.meta.env.DEV) {
    socket.on('connect', () => console.debug('[socket] connected', socket?.id))
    socket.on('disconnect', (reason) => console.debug('[socket] disconnected', reason))
    socket.on('connect_error', (err) => console.warn('[socket] connect_error', err.message))
  }

  return socket
}

export function disconnectSocket(): void {
  if (!socket) return
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
}

export function getSocket(): Socket | null {
  return socket
}
