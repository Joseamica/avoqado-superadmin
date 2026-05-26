import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { QueryError } from '@/shared/components/QueryError'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { inspectApiError } from '@/shared/lib/api-error'
import { useRateCorrections, useReverseRateCorrection } from './use-rate-correction'
import type { RateCorrectionBatch } from './api'

// TODO(perf): filter by merchantAccountId server-side once the endpoint supports it.
// Low volume today so client-side filter is acceptable.

interface Props {
  merchantAccountId: string
  venues: { id: string; name: string }[]
}

type Status = RateCorrectionBatch['status']

function statusTone(s: Status): 'success' | 'muted' | 'danger' | 'warn' {
  switch (s) {
    case 'APPLIED':
      return 'success'
    case 'REVERSED':
      return 'muted'
    case 'FAILED':
      return 'danger'
    case 'PENDING':
      return 'warn'
  }
}

function statusLabel(s: Status): string {
  switch (s) {
    case 'APPLIED':
      return 'Aplicada'
    case 'REVERSED':
      return 'Revertida'
    case 'FAILED':
      return 'Fallida'
    case 'PENDING':
      return 'Pendiente'
  }
}

export function RateCorrectionHistory({ merchantAccountId, venues }: Props) {
  const q = useRateCorrections()
  const reverse = useReverseRateCorrection()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  if (q.isLoading) {
    return <p className="text-[13px] text-[var(--ink-faint)]">Cargando…</p>
  }

  if (q.isError) {
    return (
      <QueryError error={q.error} context="cargar las correcciones" onRetry={() => q.refetch()} />
    )
  }

  const batches = (q.data ?? []).filter((b) => b.merchantAccountId === merchantAccountId)

  if (batches.length === 0) {
    return (
      <p className="text-[13px] text-[var(--ink-faint)]">
        No hay correcciones de tasa para este merchant. Aparecerán aquí cuando apliques un cambio
        retroactivo.
      </p>
    )
  }

  async function handleReverse(batchId: string) {
    try {
      await reverse.mutateAsync(batchId)
      toast.success('Corrección revertida')
    } catch (e) {
      const i = inspectApiError(e, 'revertir la corrección')
      toast.error(i.title, { description: i.description })
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <ul className="flex flex-col gap-0">
      {batches.map((b) => {
        const venueName = venues.find((v) => v.id === b.venueId)?.name ?? b.venueId
        const impact = Number(b.estimatedImpact)
        const isConfirming = confirmingId === b.id
        const isPending = reverse.isPending

        return (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--line)] py-2.5 text-[13px] last:border-0"
          >
            {/* Left: venue + account type + date */}
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-[var(--ink)]">{venueName}</span>
                <Badge tone="muted" size="sm">
                  {b.accountType}
                </Badge>
              </div>
              <span className="tabular-nums text-[12px] text-[var(--ink-faint)]">
                {formatDateTime(b.createdAt)}
              </span>
            </div>

            {/* Middle: payment count + impact */}
            <div className="flex items-center gap-2 tabular-nums">
              <span className="text-[var(--ink-muted)]">{b.paymentCount} pagos</span>
              <Badge tone={impact >= 0 ? 'success' : 'danger'} size="sm">
                {formatMoney(impact)}
              </Badge>
            </div>

            {/* Right: status + action */}
            <div className="flex items-center gap-2">
              <Badge tone={statusTone(b.status)} size="sm">
                {statusLabel(b.status)}
              </Badge>

              {b.status === 'APPLIED' && (
                <>
                  {isConfirming ? (
                    <span className="flex items-center gap-1.5 text-[12px] text-[var(--ink-muted)]">
                      ¿Confirmar?
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={isPending}
                        onClick={() => handleReverse(b.id)}
                      >
                        {isPending ? 'Revirtiendo…' : 'Sí'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => setConfirmingId(null)}
                      >
                        No
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => setConfirmingId(b.id)}
                    >
                      Deshacer
                    </Button>
                  )}
                </>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
