import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { publicAssignSerials, publicAssignSerialsCheck } from './api'
import { totalUnits, type TerminalOrder } from './types'

type DraftUnits = Record<string, Array<{ name: string; serial: string }>>

/**
 * Magic-link público para asignar serials sin login. El JWT del email lo
 * autoriza para 1) leer los items del pedido (`/assign-serials/check`) y
 * 2) postear los serials (`/assign-serials`).
 *
 * Ruta: `/admin/tpv-orders/:id/assign-serials?token=...` (FUERA del ProtectedRoute).
 */
export function AssignSerialsTpvOrderPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [tokenChecked, setTokenChecked] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const [order, setOrder] = useState<TerminalOrder | null>(null)
  const [draft, setDraft] = useState<DraftUnits>({})
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
        const data = await publicAssignSerialsCheck(id, token)
        if (cancelled) return
        setOrder(data)
        const init: DraftUnits = {}
        for (const item of data.items) {
          init[item.id] = Array.from({ length: item.quantity }, (_, i) => ({
            name: `${item.namePrefix} ${i + 1}`,
            serial: '',
          }))
        }
        setDraft(init)
      } catch (err) {
        if (cancelled) return
        setTokenError(
          (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
            ?.error ??
            (err as Error)?.message ??
            'Token inválido',
        )
      } finally {
        if (!cancelled) setTokenChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, token])

  const allFilled =
    order !== null &&
    Object.values(draft).every((units) => units.every((u) => u.name.trim() && u.serial.trim()))

  const handleSubmit = async () => {
    if (!id || !token || !order) return
    setSubmitting(true)
    setSubmitState('idle')
    try {
      const items = Object.entries(draft).map(([orderItemId, units]) => ({
        orderItemId,
        units: units.map((u) => ({ name: u.name.trim(), serial: u.serial.trim() })),
      }))
      await publicAssignSerials(id, token, { items })
      setSubmitState('ok')
    } catch (err) {
      setSubmitMessage(
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
          ?.error ??
          (err as Error)?.message ??
          'No se pudieron asignar los serials.',
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

  if (tokenError || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4">
        <div className="max-w-md space-y-4 text-center">
          <XCircle className="mx-auto h-10 w-10 text-[var(--danger)]" aria-hidden />
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.018em] text-[var(--ink)]">
            Link inválido
          </h1>
          <p className="text-[13px] text-[var(--ink-muted)]">
            {tokenError || 'No se pudo cargar el pedido.'}
          </p>
          <p className="text-[11.5px] text-[var(--ink-faint)]">
            Si el link expiró o ya fue usado, inicia sesión como superadmin para gestionar el pedido
            manualmente.
          </p>
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
            Serials asignados
          </h1>
          <p className="text-[13px] text-[var(--ink-muted)]">
            Se enviaron los códigos de activación al cliente y los terminales aparecen ya en su
            dashboard.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="eyebrow">Magic link · Sales</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold tracking-[-0.022em] text-[var(--ink)]">
            Asignar números de serie
          </h1>
          <p className="mt-1.5 text-[13px] text-[var(--ink-muted)]">
            Pedido{' '}
            <strong className="tabular font-mono text-[var(--ink)]">{order.orderNumber}</strong> ·{' '}
            {order.venue.name} · {order.contactName} ·{' '}
            <a
              href={`mailto:${order.contactEmail}`}
              className="hover:text-[var(--ink)] hover:underline"
            >
              {order.contactEmail}
            </a>{' '}
            · {totalUnits(order)} unidades
          </p>
        </div>

        {order.items.map((item) => (
          <section
            key={item.id}
            className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)] p-5"
          >
            <h2 className="font-display text-[15px] font-semibold tracking-[-0.012em] text-[var(--ink)]">
              {item.productName} <span className="text-[var(--ink-faint)]">× {item.quantity}</span>
            </h2>
            <p className="mt-1 text-[11.5px] text-[var(--ink-faint)]">
              {item.brand} {item.model}
            </p>
            <div className="mt-4 space-y-3">
              {(draft[item.id] ?? []).map((unit, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Field
                    id={`${item.id}-${idx}-name`}
                    label={`Unidad ${idx + 1} — nombre`}
                    value={unit.name}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [item.id]: prev[item.id].map((u, i) =>
                          i === idx ? { ...u, name: e.target.value } : u,
                        ),
                      }))
                    }
                  />
                  <Field
                    id={`${item.id}-${idx}-serial`}
                    label="Serial físico"
                    placeholder="Ej. A910S-2026-001234"
                    value={unit.serial}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [item.id]: prev[item.id].map((u, i) =>
                          i === idx ? { ...u, serial: e.target.value } : u,
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        ))}

        {submitState === 'error' && (
          <p className="text-[12.5px] text-[var(--danger)]">{submitMessage}</p>
        )}

        <Button
          type="button"
          size="lg"
          onClick={() => void handleSubmit()}
          disabled={!allFilled || submitting}
          className="w-full"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {submitting ? 'Asignando…' : 'Asignar y notificar al cliente'}
        </Button>
      </div>
    </div>
  )
}
