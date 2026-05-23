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
  return user.venues.some((v) => v.role === 'SUPERADMIN')
}
