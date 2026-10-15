import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext, type AuthContextValue } from '@/features/auth/use-auth'

interface MockSocket {
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  connected: boolean
}

const connectSocketMock = vi.fn<() => MockSocket>()

vi.mock('@/features/realtime/socket', () => ({
  connectSocket: () => connectSocketMock(),
  disconnectSocket: vi.fn(),
}))

function createMockSocket(): MockSocket {
  return { on: vi.fn(), off: vi.fn(), connected: true }
}

function wrapperFactory(auth: AuthContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    )
  }
}

function buildAuth(partial: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    isAuthenticated: true,
    isSuperadmin: true,
    isLoading: false,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    ...partial,
  }
}

beforeEach(() => {
  connectSocketMock.mockReset()
})

describe('useRealtimeInvalidation', () => {
  it('does NOT connect when the user is not authenticated', async () => {
    const { useRealtimeInvalidation } = await import('./use-realtime-invalidation')
    renderHook(() => useRealtimeInvalidation(), {
      wrapper: wrapperFactory(buildAuth({ isAuthenticated: false })),
    })
    expect(connectSocketMock).not.toHaveBeenCalled()
  })

  it('does NOT connect for non-superadmin', async () => {
    const { useRealtimeInvalidation } = await import('./use-realtime-invalidation')
    renderHook(() => useRealtimeInvalidation(), {
      wrapper: wrapperFactory(buildAuth({ isSuperadmin: false })),
    })
    expect(connectSocketMock).not.toHaveBeenCalled()
  })

  it('connects and registers all event handlers when authed superadmin', async () => {
    const socket = createMockSocket()
    connectSocketMock.mockReturnValue(socket)

    const { useRealtimeInvalidation } = await import('./use-realtime-invalidation')
    renderHook(() => useRealtimeInvalidation(), {
      wrapper: wrapperFactory(buildAuth()),
    })

    expect(connectSocketMock).toHaveBeenCalledTimes(1)
    // Seven domain events plus reconnection.
    expect(socket.on).toHaveBeenCalledTimes(8)
    const eventNames = socket.on.mock.calls.map((c) => c[0])
    expect(eventNames).toContain('superadmin:hybrid-campaign:updated')
    expect(eventNames).toContain('superadmin:activity-log:new')
    expect(eventNames).toContain('superadmin:kyc:updated')
    expect(eventNames).toContain('superadmin:venue:updated')
    expect(eventNames).toContain('superadmin:terminal:status')
    expect(eventNames).toContain('superadmin:merchant:updated')
    expect(eventNames).toContain('superadmin:payment:event')
  })

  it('detaches handlers on unmount', async () => {
    const socket = createMockSocket()
    connectSocketMock.mockReturnValue(socket)

    const { useRealtimeInvalidation } = await import('./use-realtime-invalidation')
    const { unmount } = renderHook(() => useRealtimeInvalidation(), {
      wrapper: wrapperFactory(buildAuth()),
    })
    unmount()
    // Each .on() pair should have a matching .off()
    expect(socket.off).toHaveBeenCalledTimes(8)
  })

  it('the handler invalidates the mapped query keys when fired', async () => {
    const socket = createMockSocket()
    connectSocketMock.mockReturnValue(socket)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={buildAuth()}>{children}</AuthContext.Provider>
        </QueryClientProvider>
      )
    }

    const { useRealtimeInvalidation } = await import('./use-realtime-invalidation')
    renderHook(() => useRealtimeInvalidation(), { wrapper: Wrapper })

    // Pull the handler for activity-log:new and fire it
    const call = socket.on.mock.calls.find((c) => c[0] === 'superadmin:activity-log:new')
    expect(call).toBeDefined()
    const handler = call?.[1] as () => void
    handler()

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['superadmin', 'activity-log'] })

    const venueCall = socket.on.mock.calls.find((c) => c[0] === 'superadmin:venue:updated')
    const venueHandler = venueCall?.[1] as () => void
    venueHandler()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['superadmin', 'venues'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['superadmin', 'venue-administration'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['superadmin', 'activity-log'] })
  })

  it('coalesces terminal bursts and cancels the pending refresh on unmount', async () => {
    vi.useFakeTimers()
    try {
      const socket = createMockSocket()
      connectSocketMock.mockReturnValue(socket)
      const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
      const { useRealtimeInvalidation } = await import('./use-realtime-invalidation')
      const { unmount } = renderHook(() => useRealtimeInvalidation(), {
        wrapper: wrapperFactory(buildAuth()),
      })
      const handler = socket.on.mock.calls.find(
        (c) => c[0] === 'superadmin:terminal:status',
      )![1] as () => void
      for (let i = 0; i < 20; i++) handler()
      expect(invalidate).not.toHaveBeenCalled()
      vi.advanceTimersByTime(500)
      expect(invalidate).toHaveBeenCalledTimes(1)
      handler()
      unmount()
      vi.advanceTimersByTime(500)
      expect(invalidate).toHaveBeenCalledTimes(1)
      invalidate.mockRestore()
    } finally {
      vi.useRealTimers()
    }
  })
})
