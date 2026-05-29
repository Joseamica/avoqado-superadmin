import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { publicApproveCheck, publicReject } from './api'

/**
 * Magic-link público para rechazar un comprobante SPEI. Two-phase:
 *  1. Al montar, valida el token con `approve/check` (mismo endpoint, mismo JWT).
 *  2. Si valid, muestra textarea + botón "Rechazar".
 *  3. Submit → `publicReject(id, token, reason)`.
 *
 * Ruta: `/admin/tpv-orders/:id/reject?token=...` (FUERA del ProtectedRoute).
 */
export function RejectTpvOrderPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [tokenChecked, setTokenChecked] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState('')

  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitState, setSubmitState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState('')

  useEffect(() => {
    if (!id || !token) {
      setTokenError('Falta el token o el id del pedido.')
      setTokenChecked(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        await publicApproveCheck(id, token)
        if (!cancelled) setTokenValid(true)
      } catch (err) {
        if (!cancelled) {
          setTokenError(
            (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
              ?.error ??
              (err as Error)?.message ??
              'Token inválido',
          )
        }
      } finally {
        if (!cancelled) setTokenChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, token])

  const handleSubmit = async () => {
    if (!id || !token) return
    if (reason.trim().length < 5) {
      setSubmitMessage('El motivo debe tener al menos 5 caracteres.')
      setSubmitState('error')
      return
    }
    setSubmitting(true)
    setSubmitState('idle')
    try {
      await publicReject(id, token, reason.trim())
      setSubmitState('ok')
    } catch (err) {
      setSubmitMessage(
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
          ?.error ??
          (err as Error)?.message ??
          'No se pudo rechazar el pedido.',
      )
      setSubmitState('error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!tokenChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--ink-faint)]" aria-hidden />
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4">
        <div className="max-w-md space-y-4 text-center">
          <XCircle className="mx-auto h-10 w-10 text-[var(--danger)]" aria-hidden />
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.018em] text-[var(--ink)]">
            Link inválido
          </h1>
          <p className="text-[13px] text-[var(--ink-muted)]">{tokenError}</p>
        </div>
      </div>
    )
  }

  if (submitState === 'ok') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4">
        <div className="max-w-md space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--success)]" aria-hidden />
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.018em] text-[var(--ink)]">
            Pedido rechazado
          </h1>
          <p className="text-[13px] text-[var(--ink-muted)]">
            Se envió un email al cliente con el motivo del rechazo. Pueden re-subir el comprobante
            en su dashboard.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4 py-8">
      <div className="w-full max-w-md space-y-4 rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)] p-6">
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.018em] text-[var(--ink)]">
          Rechazar pago SPEI
        </h1>
        <p className="text-[13px] text-[var(--ink-muted)]">
          Explica al cliente qué falta para que pueda corregirlo y re-subir el comprobante.
        </p>
        <div className="space-y-1.5">
          <label
            htmlFor="reason"
            className="block text-[12px] font-medium tracking-[-0.005em] text-[var(--ink)]"
          >
            Motivo del rechazo
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. El monto del comprobante no coincide con el total del pedido."
            rows={4}
            className="w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 py-2 text-[14px] placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>
        {submitState === 'error' && (
          <p className="text-[12px] text-[var(--danger)]">{submitMessage}</p>
        )}
        <Button
          type="button"
          variant="danger"
          size="lg"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="w-full"
        >
          {submitting ? 'Rechazando…' : 'Rechazar y notificar al cliente'}
        </Button>
      </div>
    </div>
  )
}
