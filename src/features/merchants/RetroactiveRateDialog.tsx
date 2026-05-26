import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Field } from '@/shared/ui/Field'
import {
  DateRangePicker,
  formatDateRangeLabel,
  type DateRangeValue,
} from '@/shared/ui/DateRangePicker'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import { formatMoney } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'
import { previewRateCorrection, type MissingCostMode, type RateCorrectionParams } from './api'
import { useApplyRateCorrection } from './use-rate-correction'
import type { AccountSlot, CardRates } from './types'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  venueId: string
  venueName: string
  slot: AccountSlot
  /** Raw rates just entered (0..1). */
  newRates: CardRates
  includesTax: boolean
  taxRate: number
  fixedFeePerTransaction: number | null
  /** Existing forward-only save. */
  onSaveForward: () => Promise<void>
  /** Close dialog + drawer + onSaved. */
  onDone: () => void
}

export function RetroactiveRateDialog({
  open,
  onOpenChange,
  venueId,
  venueName,
  slot,
  newRates,
  includesTax,
  taxRate,
  fixedFeePerTransaction,
  onSaveForward,
  onDone,
}: Props) {
  const [retro, setRetro] = useState(false)
  const [missingCostMode, setMissingCostMode] = useState<MissingCostMode>('FIX_PAYMENT_ONLY')
  const [range, setRange] = useState<DateRangeValue>({})
  const [confirmText, setConfirmText] = useState('')
  const [saving, setSaving] = useState(false)

  const apply = useApplyRateCorrection()

  // DateRangeValue ya transmite ISO 8601 UTC en startTime/endTime; mapeamos directo.
  const params: RateCorrectionParams = {
    accountType: slot,
    newVenueRates: {
      debitRate: newRates.DEBIT,
      creditRate: newRates.CREDIT,
      amexRate: newRates.AMEX,
      internationalRate: newRates.INTERNATIONAL,
      includesTax,
      taxRate,
      fixedFeePerTransaction,
    },
    missingCostMode,
    dateFrom: range.startTime,
    dateTo: range.endTime,
  }

  const previewQ = useQuery({
    queryKey: [
      'superadmin',
      'rate-corrections',
      'preview',
      venueId,
      slot,
      missingCostMode,
      range.startTime ?? null,
      range.endTime ?? null,
    ],
    queryFn: () => previewRateCorrection(venueId, params),
    enabled: open && retro,
    staleTime: 0,
  })

  const preview = previewQ.data
  const rangeLabel = formatDateRangeLabel(range) ?? 'Todo el histórico'

  // El backend rechaza scopes > 200 pagos (se procesa síncrono). Lo gateamos aquí
  // para no dejar al operador pegarle a un error crudo en inglés: deshabilita el
  // botón y muestra copy en español pidiendo acotar el periodo.
  const MAX_SYNC_PAYMENTS = 200
  const tooMany = !!preview && preview.inScopeCount > MAX_SYNC_PAYMENTS

  const canApply =
    confirmText.trim() === 'APLICAR' &&
    !!preview &&
    preview.inScopeCount > 0 &&
    !tooMany &&
    preview.venuePricingAvailable &&
    (missingCostMode !== 'CREATE_COST' || preview.costStructureAvailable) &&
    !apply.isPending

  async function handleForward() {
    try {
      setSaving(true)
      await onSaveForward()
      toast.success('Pricing actualizado')
      onDone()
    } catch (e) {
      const i = inspectApiError(e, 'guardar el pricing')
      toast.error(i.title, { description: i.description })
    } finally {
      setSaving(false)
    }
  }

  async function handleApply() {
    try {
      const batch = await apply.mutateAsync({ venueId, params })
      toast.success(`${batch.paymentCount} pagos recalculados`)
      onDone()
    } catch (e) {
      const i = inspectApiError(e, 'recalcular los pagos')
      toast.error(i.title, { description: i.description })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Guardar pricing · {venueName}</DialogTitle>
          <DialogDescription>Slot {slot}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Retroactive toggle */}
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              className="mt-0.5"
              checked={retro}
              onCheckedChange={(c) => setRetro(c === true)}
            />
            <span className="text-[13px] leading-snug text-[var(--ink)]">
              También recalcular las transacciones pasadas con esta tasa
            </span>
          </label>

          {!retro && (
            <p className="text-[12px] leading-snug text-[var(--ink-faint)]">
              Por defecto sólo cambia de aquí en adelante. Marca esto para corregir también el
              histórico.
            </p>
          )}

          {retro && (
            <div className="flex flex-col gap-4 border-t border-[var(--line)] pt-4">
              {/* Preview impact */}
              {previewQ.isError ? (
                <QueryError
                  error={previewQ.error}
                  context="calcular el impacto"
                  onRetry={() => previewQ.refetch()}
                  isRetrying={previewQ.isFetching}
                />
              ) : previewQ.isLoading ? (
                <p className="text-[13px] text-[var(--ink-faint)]">Calculando impacto…</p>
              ) : preview && preview.inScopeCount === 0 ? (
                <p className="text-[13px] leading-snug text-[var(--ink-muted)]">
                  No hay pagos pasados en este scope para recalcular.
                </p>
              ) : preview ? (
                <div className="flex flex-col gap-2">
                  <Row label="Pagos a recalcular">
                    <span className="tabular-nums text-[var(--ink)]">{preview.inScopeCount}</span>
                  </Row>
                  <Row label="Sin detalle de costo">
                    <span className="tabular-nums text-[var(--ink)]">
                      {preview.missingCostCount}
                    </span>
                  </Row>
                  <Row label="Cambio en fees">
                    <Badge tone={preview.estimatedImpact >= 0 ? 'success' : 'danger'} size="sm">
                      <span className="tabular-nums">{formatMoney(preview.estimatedImpact)}</span>
                    </Badge>
                  </Row>
                  {preview.negativeMarginCount > 0 && (
                    <div className="flex justify-end pt-0.5">
                      <Badge tone="warn" size="sm">
                        {preview.negativeMarginCount} pago(s) quedarían con margen negativo
                      </Badge>
                    </div>
                  )}
                </div>
              ) : null}

              {tooMany && (
                <p className="text-[12px] leading-snug text-[var(--danger)]">
                  Demasiados pagos ({preview?.inScopeCount}). El máximo por corrección es{' '}
                  {MAX_SYNC_PAYMENTS}. Acota el periodo con un rango de fechas más corto.
                </p>
              )}

              {/* Missing-cost choice — sólo cuando hay pagos sin detalle de costo */}
              {preview && preview.missingCostCount > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] font-medium text-[var(--ink)]">
                    Pagos sin detalle de costo
                  </p>
                  <RadioRow
                    label="Sólo corregir el cobro"
                    checked={missingCostMode === 'FIX_PAYMENT_ONLY'}
                    onSelect={() => setMissingCostMode('FIX_PAYMENT_ONLY')}
                  />
                  <RadioRow
                    label="Crear también el detalle de costo"
                    checked={missingCostMode === 'CREATE_COST'}
                    disabled={!preview.costStructureAvailable}
                    onSelect={() => setMissingCostMode('CREATE_COST')}
                  />
                  {!preview.costStructureAvailable && (
                    <p className="text-[11.5px] leading-snug text-[var(--ink-faint)]">
                      Este merchant no tiene estructura de costo de proveedor.
                    </p>
                  )}
                </div>
              )}

              {/* Date range (optional) */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[12px] font-medium text-[var(--ink)]">Periodo (opcional)</p>
                <div className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)]">
                  <DateRangePicker value={range} onApply={setRange} />
                </div>
                <p className="text-[11.5px] text-[var(--ink-faint)]">
                  Vacío = todo el histórico.{' '}
                  <span className="text-[var(--ink-muted)]">{rangeLabel}</span>
                </p>
              </div>

              {/* Typed confirm */}
              <Field
                name="retro-confirm"
                label="Escribe APLICAR para confirmar"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          {retro ? (
            <Button onClick={handleApply} disabled={!canApply}>
              {apply.isPending
                ? 'Recalculando…'
                : `Recalcular ${preview?.inScopeCount ?? ''} pagos`}
            </Button>
          ) : (
            <Button onClick={handleForward} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Label izquierda (muted) + valor derecha — fila de dato del preview. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-[var(--ink-muted)]">{label}</span>
      {children}
    </div>
  )
}

/** Checkbox actuando como radio para la elección de missing-cost mode. */
function RadioRow({
  label,
  checked,
  disabled,
  onSelect,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-2.5 text-[13px]',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(c) => {
          if (c === true && !disabled) onSelect()
        }}
      />
      <span className={checked ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'}>{label}</span>
    </label>
  )
}
