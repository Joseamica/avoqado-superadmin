import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { publicApprove } from './api'

/**
 * Magic-link público de aprobación de SPEI. Auto-dispara el endpoint al
 * montar — el operador hace click en el botón del email y este pageview
 * marca el pedido como pagado.
 *
 * Ruta: `/admin/tpv-orders/:id/approve?token=...` (FUERA del ProtectedRoute).
 */
export function ApproveTpvOrderPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  // Guard against React StrictMode double-fire and accidental re-mounts.
  // Without this, the 2nd fire hits the backend with the order already PAID and our
  // idempotent fallback returns orderNumber:'' — overwriting the good value.
  const firedRef = useRef(false)

  useEffect(() => {
    if (!id || !token) {
      setState('error')
      setMessage('Falta el token o el id del pedido.')
      return
    }
    if (firedRef.current) return
    firedRef.current = true

    let cancelled = false
    void (async () => {
      try {
        const result = await publicApprove(id, token)
        if (cancelled) return
        // Only set orderNumber if we got a non-empty value (idempotent fallback returns '').
        if (result.orderNumber) setOrderNumber(result.orderNumber)
        setState('ok')
      } catch (err) {
        if (cancelled) return
        setMessage(
          (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
            ?.error ??
            (err as Error)?.message ??
            'No se pudo aprobar el pedido.',
        )
        setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        {state === 'loading' && (
          <>
            <Loader2
              className="mx-auto h-10 w-10 animate-spin text-[var(--ink-faint)]"
              aria-hidden
            />
            <p className="text-[13px] text-[var(--ink-muted)]">Aprobando pedido…</p>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--success)]" aria-hidden />
            <h1 className="font-display text-[22px] font-semibold tracking-[-0.018em] text-[var(--ink)]">
              Pedido aprobado
            </h1>
            <p className="text-[13px] text-[var(--ink-muted)]">
              {orderNumber && <span className="tabular font-mono">{orderNumber}</span>}
              {orderNumber ? ' aprobado.' : 'Aprobado.'} Le enviamos los emails de confirmación al
              cliente y de asignación a sales.
            </p>
            <p className="text-[11.5px] text-[var(--ink-faint)]">Puedes cerrar esta pestaña.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-[var(--danger)]" aria-hidden />
            <h1 className="font-display text-[22px] font-semibold tracking-[-0.018em] text-[var(--ink)]">
              No pudimos aprobar el pedido
            </h1>
            <p className="text-[13px] text-[var(--ink-muted)]">{message}</p>
            <p className="text-[11.5px] text-[var(--ink-faint)]">
              Si el link expiró, inicia sesión como superadmin para gestionar el pedido manualmente.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
