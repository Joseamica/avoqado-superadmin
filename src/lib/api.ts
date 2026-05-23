import axios, { AxiosError } from 'axios'

/**
 * El backend `avoqado-server` autentica al cliente vía cookies HTTP-only
 * emitidas por `/dashboard/auth/login`. Por eso `withCredentials: true`
 * y no hay interceptor que inyecte tokens.
 *
 * El interceptor de response sólo emite un evento global cuando el server
 * responde 401 — el AuthContext lo escucha y limpia la sesión.
 */

const FALLBACK_BASE_URL = 'http://localhost:3000/api/v1'

function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured && configured.length > 0) return configured
  if (import.meta.env.DEV) return FALLBACK_BASE_URL
  return 'https://api.avoqado.io/api/v1'
}

export const api = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: true,
  timeout: 20_000,
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    return Promise.reject(error)
  },
)

export type ApiError = AxiosError<{ message?: string; error?: string }>

export function readApiErrorMessage(error: unknown, fallback = 'Algo salió mal'): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { message?: string; error?: string } | undefined
    return payload?.message ?? payload?.error ?? error.message ?? fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}
