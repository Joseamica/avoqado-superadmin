import axios from 'axios'

/**
 * Categoriza un error de cualquier capa (axios, JS native, unknown) en algo
 * que la UI pueda mostrar sin escribir lógica de inspect en cada página.
 *
 * Regla en CLAUDE.md: prohibido mostrar "No pudimos ..." genérico. Toda
 * UI de error pasa por `inspectApiError()` (o el componente `<QueryError>`).
 */

export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'notfound'
  | 'validation'
  | 'server'
  | 'unknown'

export interface ApiErrorInfo {
  kind: ApiErrorKind
  status?: number
  /** Headline corto: "Sin conexión al backend", "Error del servidor (500)". */
  title: string
  /** Una frase explicando qué pasó y qué puede hacer el usuario. */
  description: string
  /** Mensaje crudo del server (lo mostramos en details expandible si difiere). */
  serverMessage?: string
}

interface ServerErrorPayload {
  message?: string
  error?: string
}

/**
 * @param context — verbo en infinitivo, ej. "cargar el resumen", "exportar el CSV".
 *                  Se inyecta en el mensaje de network error para que sea específico.
 */
export function inspectApiError(error: unknown, context?: string): ApiErrorInfo {
  if (axios.isAxiosError(error)) {
    // Sin response del server → red caída o server inalcanzable
    if (!error.response) {
      const reason =
        error.code === 'ECONNABORTED'
          ? 'la petición agotó su tiempo de espera'
          : 'no pudimos alcanzar el servidor'
      return {
        kind: 'network',
        title: 'Sin conexión al backend',
        description: context
          ? `Al ${context}: ${reason}. Verifica VITE_API_URL y que avoqado-server esté corriendo.`
          : `${reason.charAt(0).toUpperCase()}${reason.slice(1)}. Verifica VITE_API_URL y que avoqado-server esté corriendo.`,
      }
    }

    const status = error.response.status
    const data = error.response.data as ServerErrorPayload | undefined
    const serverMessage = data?.message ?? data?.error

    if (status === 401) {
      return {
        kind: 'unauthorized',
        status,
        title: 'Sesión expirada',
        description: 'Tu sesión ya no es válida. Recarga la página para volver a iniciar sesión.',
        serverMessage,
      }
    }
    if (status === 403) {
      return {
        kind: 'forbidden',
        status,
        title: 'Acceso denegado',
        description: 'Tu cuenta no tiene permiso para esta acción. Pide a ops que revise tu rol.',
        serverMessage,
      }
    }
    if (status === 404) {
      return {
        kind: 'notfound',
        status,
        title: 'Endpoint no encontrado',
        description:
          'El recurso no existe en este server. Probablemente avoqado-server está en una versión vieja y le falta el endpoint.',
        serverMessage,
      }
    }
    if (status === 400 || status === 422) {
      return {
        kind: 'validation',
        status,
        title: 'Datos inválidos',
        description: serverMessage ?? 'La petición tiene campos que el server no aceptó.',
        serverMessage,
      }
    }
    if (status === 429) {
      return {
        kind: 'unknown',
        status,
        title: 'Demasiadas peticiones',
        description: 'Espera unos segundos y reintenta.',
        serverMessage,
      }
    }
    if (status >= 500) {
      return {
        kind: 'server',
        status,
        title: `Error del servidor (${status})`,
        description:
          serverMessage ??
          'El servidor devolvió un error interno. Revisa los logs de avoqado-server.',
        serverMessage,
      }
    }
    return {
      kind: 'unknown',
      status,
      title: `Error HTTP ${status}`,
      description: serverMessage ?? error.message ?? 'Respuesta inesperada del server.',
      serverMessage,
    }
  }

  if (error instanceof Error) {
    return {
      kind: 'unknown',
      title: 'Error inesperado',
      description: error.message,
    }
  }

  return {
    kind: 'unknown',
    title: 'Error inesperado',
    description: 'Ocurrió un error que no pudimos categorizar.',
  }
}
