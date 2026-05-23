import { createContext, useContext } from 'react'
import type { LoginPayload, LoginResponse, SessionUser } from './api'

/**
 * Sólo tipos + context object + hook viven aquí.
 * El `AuthProvider` (componente) está en `./AuthProvider.tsx`.
 * Separar el contexto del componente evita el bug de React Fast Refresh donde
 * un hot reload del provider crea un AuthContext nuevo y rompe `useContext`
 * en consumidores que aún tenían el viejo. La regla de oro:
 * archivos `.tsx` exportan SÓLO componentes; lo demás vive en `.ts`.
 */

export interface AuthContextValue {
  user: SessionUser | null
  isAuthenticated: boolean
  isSuperadmin: boolean
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<LoginResponse>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
