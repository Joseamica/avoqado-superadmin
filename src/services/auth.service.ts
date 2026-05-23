import { api } from '@/lib/api'

export type StaffRole = 'SUPERADMIN' | 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF'

export interface SessionVenue {
  id: string
  name: string
  slug: string
  logo: string | null
  role: StaffRole
  timezone?: string
}

export interface SessionUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  photoUrl: string | null
  /**
   * Top-level role. El backend lo devuelve para "master login" y para staff
   * regular como `highestRole`. Si está presente, lo usamos como source of truth;
   * si no, caemos al chequeo per-venue.
   */
  role?: StaffRole
  venues: SessionVenue[]
}

export interface AuthStatusResponse {
  authenticated: boolean
  user: SessionUser | null
}

export interface LoginPayload {
  email: string
  password: string
  rememberMe?: boolean
}

export interface LoginResponse {
  message: string
  staff: SessionUser
}

const PATH = '/dashboard/auth'

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(`${PATH}/login`, payload)
  return data
}

export async function logout(): Promise<void> {
  await api.post(`${PATH}/logout`)
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  const { data } = await api.get<AuthStatusResponse>(`${PATH}/status`)
  return data
}

export async function getGoogleAuthUrl(): Promise<{ authUrl: string }> {
  const { data } = await api.get<{ authUrl: string }>(`${PATH}/google/url`)
  return data
}

export async function googleOAuthCallback(code: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(`${PATH}/google/callback`, { code })
  return data
}

export function hasSuperadminRole(user: SessionUser | null | undefined): boolean {
  if (!user) return false
  // El backend (avoqado-server/src/controllers/dashboard/auth.dashboard.controller.ts)
  // devuelve `user.role` al top level tanto para master-login como para staff regular
  // (calculado como `highestRole`). Lo usamos primero como source of truth.
  if (user.role === 'SUPERADMIN') return true
  // Fallback defensivo: por si algún endpoint emite sólo venues con role per-venue.
  return user.venues?.some((v) => v.role === 'SUPERADMIN') ?? false
}
