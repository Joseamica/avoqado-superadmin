import { api } from '@/shared/lib/api'

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

/**
 * Login con Google.
 *
 * Usamos el endpoint `one-tap` (que recibe el ID token de Google Identity
 * Services) y NO el par `google/url` + `google/callback` del flujo redirect.
 * Motivo concreto, no preferencia: el `redirect_uri` del flujo redirect está
 *  FIJO en el backend a `FRONTEND_URL + '/auth/google/callback'`
 * (avoqado-server/src/services/dashboard/googleOAuth.service.ts) — es decir,
 * apunta siempre al dashboard legacy. Si mandáramos al operador por ahí,
 * Google lo devolvería al dashboard, no a esta consola.
 *
 * El endpoint one-tap no tiene redirect: el navegador obtiene el credential de
 * Google y lo mandamos por POST. El backend lo verifica contra el
 * GOOGLE_CLIENT_ID (`verifyGoogleToken`) y aplica exactamente las mismas reglas
 * que el login con contraseña: si el correo no tiene Staff ni invitación viva,
 * responde 403. La sesión queda en las mismas cookies HTTP-only.
 *
 * Ojo con el shape: este endpoint devuelve `user`, no `staff` como
 * `/dashboard/auth/login`.
 */
export interface GoogleLoginResponse {
  success: boolean
  message: string
  user: SessionUser
  isNewUser: boolean
}

export async function googleSignIn(credential: string): Promise<GoogleLoginResponse> {
  const { data } = await api.post<GoogleLoginResponse>(`${PATH}/google/one-tap`, { credential })
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
