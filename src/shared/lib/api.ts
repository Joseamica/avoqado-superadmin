import axios, { AxiosError } from 'axios'

/**
 * El backend `avoqado-server` autentica al cliente vía cookies HTTP-only
 * emitidas por `/dashboard/auth/login`. Por eso `withCredentials: true`
 * y no hay interceptor que inyecte tokens.
 *
 * El interceptor de response emite un evento global cuando el server responde 401
 * — el AuthContext lo escucha y limpia la sesión — SALVO en los endpoints que
 * devuelven 401 por una credencial de terceros (ver `esUn401DeSesion`).
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

/**
 * Endpoints que responden **401 por una credencial de TERCEROS**, no por tu sesión.
 *
 * `verify-apikey` valida una apiKey de AngelPay contra AngelPay: su 401 significa
 * «AngelPay rechazó esa llave», no «tu sesión murió». Tratarlo como sesión saca al
 * operador de la consola por escribir mal una apiKey — que es justo lo que pasaba
 * al dar de alta un merchant de AngelPay.
 *
 * 🔴 Es una lista EXPLÍCITA de rutas, nunca una heurística sobre el texto del error:
 * clasificar por el mensaje ya rompió antes en los aparatos (un 5xx que mencionaba
 * «400» se leía como rechazo definitivo). Mismo defecto y mismo arreglo que el 401
 * del PIN de «cambiar usuario» en avoqado-android.
 */
const RUTAS_CON_401_AJENO_A_LA_SESION = ['/superadmin/merchant-accounts/verify-apikey']

/**
 * ¿Ese 401 habla de la SESIÓN del operador? Sin URL devuelve `true`: no poder
 * descartarlo es motivo para cerrar sesión, que es el lado seguro — dejar viva una
 * sesión muerta es peor que pedir un login de más.
 */
export function esUn401DeSesion(url: string | undefined | null): boolean {
  if (!url) return true
  return !RUTAS_CON_401_AJENO_A_LA_SESION.some((ruta) => url.includes(ruta))
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && esUn401DeSesion(error.config?.url)) {
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
