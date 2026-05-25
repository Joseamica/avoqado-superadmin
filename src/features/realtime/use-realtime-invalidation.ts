import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { connectSocket } from '@/features/realtime/socket'

/**
 * Map de evento del backend → query keys a invalidar.
 *
 * Política de real-time del superadmin:
 *
 *   El servidor emite eventos chiquitos (`{type, id}`). El cliente NO recibe
 *   datos a través del socket — sólo invalida las queries afectadas, y
 *   TanStack Query refetch del endpoint REST trae lo fresco. Esto:
 *
 *     - mantiene un único path de datos (REST → cache)
 *     - aprovecha la dedup y staleTime de TanStack Query
 *     - permite usar permission middleware sólo en la capa REST
 *     - escala sin que cada cliente reciba payloads grandes por socket
 *
 * Cuando agregues una página nueva al superadmin, mapea su evento aquí.
 */
const EVENT_INVALIDATIONS: ReadonlyArray<readonly [string, ReadonlyArray<readonly string[]>]> = [
  ['superadmin:activity-log:new', [['superadmin', 'activity-log']]],
  ['superadmin:kyc:updated', [['superadmin', 'kyc']]],
  ['superadmin:venue:updated', [['superadmin', 'venues']]],
  ['superadmin:terminal:status', [['superadmin', 'terminals']]],
  ['superadmin:merchant:updated', [['superadmin', 'merchants']]],
  [
    'superadmin:payment:event',
    [
      ['superadmin', 'payments'],
      ['superadmin', 'activity-log'],
    ],
  ],
]

/**
 * Llama esto en algún componente alto que sólo se renderiza con sesión activa
 * (típicamente `AppLayout`). Conecta el socket, registra handlers y los limpia
 * al desmontar.
 */
export function useRealtimeInvalidation(): void {
  const { isAuthenticated, isSuperadmin } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isAuthenticated || !isSuperadmin) return

    const socket = connectSocket()

    const cleanup = EVENT_INVALIDATIONS.map(([event, keys]) => {
      const handler = () => {
        for (const key of keys) {
          void queryClient.invalidateQueries({ queryKey: [...key] })
        }
      }
      socket.on(event, handler)
      return () => socket.off(event, handler)
    })

    return () => {
      for (const off of cleanup) off()
    }
  }, [isAuthenticated, isSuperadmin, queryClient])
}
