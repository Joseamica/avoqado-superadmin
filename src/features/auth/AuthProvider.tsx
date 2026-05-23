import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as authService from './api'
import type { LoginPayload, LoginResponse } from './api'
import { AuthContext, type AuthContextValue } from './use-auth'
import { disconnectSocket } from '@/features/realtime/socket'

const SESSION_HINT_KEY = 'avoqado_session_hint'
const AUTH_BROADCAST_CHANNEL = 'avoqado-superadmin-auth'

type BroadcastMessage = { type: 'login' } | { type: 'logout' }

function readSessionHint(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SESSION_HINT_KEY) === 'true'
}

function writeSessionHint(value: boolean): void {
  if (typeof window === 'undefined') return
  if (value) window.localStorage.setItem(SESSION_HINT_KEY, 'true')
  else window.localStorage.removeItem(SESSION_HINT_KEY)
}

function createAuthChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: ['auth', 'status'],
    queryFn: authService.getAuthStatus,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: true,
  })

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: () => {
      writeSessionHint(true)
      // NO invalidamos `['auth', 'status']` aquí — el caller (LoginPage) hace
      // el fetch fresh manualmente y setea el resultado con `setQueryData`.
      // Invalidar acá creaba un race entre el refetch automático y el fetch
      // del caller, y el cancelado tiraba CancelledError → toast confuso aunque
      // el login funcionara.
    },
  })

  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      writeSessionHint(false)
      disconnectSocket()
      queryClient.removeQueries({ queryKey: ['auth', 'status'] })
      queryClient.clear()
    },
  })

  // Sync logout across tabs: cuando alguien cierra sesión en otro tab,
  // este tab también limpia su estado sin hacer la request de logout otra vez.
  useEffect(() => {
    const channel = createAuthChannel()
    if (!channel) return

    const handle = (event: MessageEvent<BroadcastMessage>) => {
      if (event.data?.type === 'logout') {
        writeSessionHint(false)
        disconnectSocket()
        queryClient.setQueryData(['auth', 'status'], { authenticated: false, user: null })
        queryClient.clear()
      } else if (event.data?.type === 'login') {
        void queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
      }
    }

    channel.addEventListener('message', handle)
    return () => {
      channel.removeEventListener('message', handle)
      channel.close()
    }
  }, [queryClient])

  // Cuando axios recibe un 401, el interceptor en src/shared/lib/api.ts dispara este evento.
  useEffect(() => {
    const onUnauthorized = () => {
      writeSessionHint(false)
      disconnectSocket()
      queryClient.setQueryData(['auth', 'status'], { authenticated: false, user: null })
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [queryClient])

  const login = useCallback(
    async (payload: LoginPayload): Promise<LoginResponse> => {
      const response = await loginMutation.mutateAsync(payload)
      const channel = createAuthChannel()
      channel?.postMessage({ type: 'login' } satisfies BroadcastMessage)
      channel?.close()
      return response
    },
    [loginMutation],
  )

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync()
    const channel = createAuthChannel()
    channel?.postMessage({ type: 'logout' } satisfies BroadcastMessage)
    channel?.close()
  }, [logoutMutation])

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
  }, [queryClient])

  const sessionHint = readSessionHint()
  const user = statusQuery.data?.user ?? null
  const isAuthenticated = Boolean(statusQuery.data?.authenticated)
  const isSuperadmin = authService.hasSuperadminRole(user)
  const isLoading = statusQuery.isLoading && sessionHint && !statusQuery.data

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isSuperadmin,
      isLoading,
      login,
      logout,
      refresh,
    }),
    [user, isAuthenticated, isSuperadmin, isLoading, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
