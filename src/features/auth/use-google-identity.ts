import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Integración con Google Identity Services (GIS) para el botón
 * "Continuar con Google" del LoginPage.
 *
 * Renderizamos el botón OFICIAL de Google (`renderButton`) en lugar de dibujar
 * uno propio que dispare `prompt()`: el prompt de One Tap depende de cookies de
 * terceros, FedCM y del ITP de Safari — cuando el navegador lo bloquea no pasa
 * nada visible y el operador se queda sin forma de entrar. El botón renderizado
 * siempre funciona y además cumple los lineamientos de marca de Google, que
 * prohíben inventar un botón propio con su logo.
 *
 * Tampoco lanzamos el prompt automático de One Tap: esta es una consola interna
 * y un popup que aparece solo al cargar es intrusivo (y falla seguido).
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** Rango que acepta `renderButton`; fuera de él Google ignora el ancho. */
const MIN_BUTTON_WIDTH = 200
const MAX_BUTTON_WIDTH = 400

/**
 * Cuánto esperamos a que Google inyecte su botón antes de darlo por fallido.
 * Normalmente aparece en milisegundos; el margen es para una red lenta.
 */
const BUTTON_RENDER_TIMEOUT_MS = 2500
const BUTTON_RENDER_POLL_MS = 100

interface GoogleCredentialResponse {
  credential?: string
}

/**
 * Google avisa por aquí cuando el origen no está registrado en la consola de
 * Google Cloud. Es la ÚNICA señal programática de ese caso: `renderButton`
 * dibuja el botón con toda normalidad y el rechazo (`Error 400:
 * origin_mismatch`) sólo aparece dentro del popup, ya con el operador dentro —
 * sin este callback la app nunca se entera.
 */
interface GoogleGsiError {
  type?: 'unregistered_origin' | 'unknown_reason' | string
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    error_callback?: (error: GoogleGsiError) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    itp_support?: boolean
    use_fedcm_for_prompt?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'small' | 'medium' | 'large'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      logo_alignment?: 'left' | 'center'
      width?: number
      locale?: string
    },
  ) => void
  cancel: () => void
  disableAutoSelect: () => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

export type GoogleIdentityStatus =
  | 'disabled'
  | 'loading'
  | 'ready'
  /** El script cargó pero Google no dibujó nada — casi siempre el origen no está autorizado. */
  | 'blocked'
  | 'error'

/**
 * Carga del script, memoizada a nivel de módulo.
 *
 * Deliberadamente NO removemos el `<script>` en el cleanup (el hook equivalente
 * del dashboard legacy sí lo hace). Quitarlo deja `window.google` colgando y el
 * siguiente montaje — un StrictMode double-mount o simplemente volver a /login —
 * encuentra el objeto a medias y el botón nunca aparece. El script es idempotente
 * y pesa poco: se carga una vez por pestaña y se queda.
 */
let gisLoader: Promise<void> | null = null

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Identity Services requiere un navegador'))
  }
  if (window.google?.accounts?.id) return Promise.resolve()
  if (gisLoader) return gisLoader

  gisLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    const script = existing ?? document.createElement('script')

    const onLoad = () => {
      if (window.google?.accounts?.id) resolve()
      else reject(new Error('Google Identity Services cargó sin exponer accounts.id'))
    }
    const onError = () => {
      // La promesa cacheada se descarta para permitir un reintento (el fallo
      // típico es un bloqueador de anuncios o una red intermitente).
      gisLoader = null
      reject(new Error('No se pudo cargar Google Identity Services'))
    }

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })

    if (!existing) {
      script.src = GIS_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  })

  return gisLoader
}

/**
 * Espera a que Google inyecte su botón dentro del contenedor.
 * Devuelve false si se agotó el tiempo sin que apareciera nada.
 */
async function waitForRenderedButton(
  target: HTMLElement,
  isCancelled: () => boolean,
): Promise<boolean> {
  const deadline = Date.now() + BUTTON_RENDER_TIMEOUT_MS
  while (!isCancelled()) {
    if (target.firstElementChild) return true
    if (Date.now() >= deadline) return false
    await new Promise((resolve) => setTimeout(resolve, BUTTON_RENDER_POLL_MS))
  }
  return false
}

interface UseGoogleIdentityOptions {
  /** Se dispara con el ID token de Google cuando el operador elige su cuenta. */
  onCredential: (credential: string) => void
  /** No renderizar el botón (ej. ya hay sesión activa). */
  disabled?: boolean
}

interface UseGoogleIdentityResult {
  status: GoogleIdentityStatus
  /** Contenedor donde Google inyecta su botón. */
  containerRef: (node: HTMLDivElement | null) => void
  /** Reintento manual tras un fallo de carga. */
  retry: () => void
}

export function useGoogleIdentity({
  onCredential,
  disabled = false,
}: UseGoogleIdentityOptions): UseGoogleIdentityResult {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  const enabled = Boolean(clientId) && !disabled

  const [status, setStatus] = useState<GoogleIdentityStatus>(enabled ? 'loading' : 'disabled')
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [attempt, setAttempt] = useState(0)

  // El callback se pasa una sola vez a `initialize` y Google lo guarda. Lo
  // leemos desde un ref para que un re-render del LoginPage (cada tecleo en el
  // form) no obligue a re-inicializar GIS.
  const onCredentialRef = useRef(onCredential)
  useEffect(() => {
    onCredentialRef.current = onCredential
  }, [onCredential])

  const containerRef = useCallback((next: HTMLDivElement | null) => setNode(next), [])
  const retry = useCallback(() => {
    setStatus('loading')
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setStatus('disabled')
      return
    }
    if (!node) return

    let cancelled = false
    // Google puede avisar del origen rechazado ANTES o DESPUÉS de que
    // terminemos de esperar el botón. La bandera hace que 'blocked' gane
    // siempre: sin ella, un aviso temprano quedaba pisado por el 'ready' que
    // llega después y la pantalla mentía.
    let originRejected = false

    const renderInto = (target: HTMLDivElement) => {
      const measured = Math.round(target.getBoundingClientRect().width)
      const width = Math.min(MAX_BUTTON_WIDTH, Math.max(MIN_BUTTON_WIDTH, measured))
      window.google?.accounts.id.renderButton(target, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width,
        locale: 'es',
      })
    }

    /**
     * Google escribe un `width` en PÍXELES fijos sobre el nodo que inyecta y no
     * lo recalcula nunca más: al rotar el teléfono o cruzar un breakpoint, el
     * botón se queda con el ancho viejo y deja de alinear con el CTA de arriba
     * (medido: contenedor de 360 px con el botón clavado en 327). Lo estiramos
     * al contenedor para que el ancho lo mande el layout.
     *
     * 🔴 Va DESPUÉS de esperar el nodo, no justo tras `renderButton`: Google no
     * siempre inyecta de forma síncrona, así que aplicarlo de inmediato es una
     * carrera que a veces se pierde — y cuando se pierde el botón queda corto
     * sin ningún síntoma. Se vio en el navegador, no en los tests.
     */
    const stretchToContainer = (target: HTMLDivElement) => {
      const rendered = target.firstElementChild
      if (rendered instanceof HTMLElement) {
        rendered.style.setProperty('width', '100%', 'important')
      }
    }

    loadGoogleIdentityScript()
      .then(async () => {
        if (cancelled || !window.google) return

        window.google.accounts.id.initialize({
          client_id: clientId as string,
          callback: (response) => {
            if (response.credential) onCredentialRef.current(response.credential)
          },
          error_callback: (error) => {
            // `unregistered_origin` = este dominio no está en los orígenes
            // autorizados del client ID. Lo pintamos en la pantalla en vez de
            // dejar que el operador choque con el popup de Google.
            if (error?.type !== 'unregistered_origin') return
            originRejected = true
            if (!cancelled) setStatus('blocked')
          },
          // Sin prompt automático: `auto_select` sólo aplica a One Tap, que no
          // usamos, pero lo apagamos explícitamente para que un cambio futuro
          // no reintroduzca un login silencioso en una consola de operaciones.
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
        })

        renderInto(node)

        // 🔴 Google NO lanza error cuando el origen no está autorizado en la
        // consola de Google Cloud: `renderButton` regresa normal y el fallo
        // sólo aparece en la consola del navegador
        // ("The given origin is not allowed for the given client ID").
        // El contenedor queda VACÍO. Sin esta comprobación, el operador ve un
        // hueco mudo y no tiene forma de saber qué falta. Preguntamos si de
        // verdad se dibujó algo y, si no, lo decimos con todas sus letras.
        const drew = await waitForRenderedButton(node, () => cancelled)
        if (cancelled) return
        if (drew) stretchToContainer(node)
        setStatus(drew && !originRejected ? 'ready' : 'blocked')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [enabled, clientId, node, attempt])

  return { status, containerRef, retry }
}
