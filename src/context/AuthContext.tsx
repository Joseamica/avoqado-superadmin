import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as authService from '@/services/auth.service'
import type { LoginPayload, SessionUser } from '@/services/auth.service'

const SESSION_HINT_KEY = 'avoqado_session_hint'

interface AuthContextValue {
  user: SessionUser | null
  isAuthenticated: boolean
  isSuperadmin: boolean
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readSessionHint(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SESSION_HINT_KEY) === 'true'
}

function writeSessionHint(value: boolean): void {
  if (typeof window === 'undefined') return
  if (value) {
    window.localStorage.setItem(SESSION_HINT_KEY, 'true')
  } else {
    window.localStorage.removeItem(SESSION_HINT_KEY)
  }
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
      void queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      writeSessionHint(false)
      queryClient.removeQueries({ queryKey: ['auth', 'status'] })
      queryClient.clear()
    },
  })

  useEffect(() => {
    const onUnauthorized = () => {
      writeSessionHint(false)
      queryClient.setQueryData(['auth', 'status'], {
        authenticated: false,
        user: null,
      })
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [queryClient])

  const login = useCallback(
    async (payload: LoginPayload) => {
      await loginMutation.mutateAsync(payload)
    },
    [loginMutation],
  )

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync()
  }, [logoutMutation])

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
  }, [queryClient])

  const sessionHint = readSessionHint()
  const user = statusQuery.data?.user ?? null
  const isAuthenticated = Boolean(statusQuery.data?.authenticated)
  const isSuperadmin = authService.hasSuperadminRole(user)

  // While the first auth-status request is in flight, trust the session hint
  // so we don't flash the login screen for already-authenticated users.
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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
