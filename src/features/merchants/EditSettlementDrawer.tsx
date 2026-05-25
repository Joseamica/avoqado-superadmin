import { useState } from 'react'
import { toast } from 'sonner'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerSubtitle,
  DrawerBody,
  DrawerFooter,
} from '@/shared/ui/Drawer'
import { Button } from '@/shared/ui/Button'
import { Combobox } from '@/shared/ui/Combobox'
import { inspectApiError } from '@/shared/lib/api-error'
import { useHolidays, useSaveSettlement } from './use-merchants'
import { projectSettlementDate, mxCivilToday, formatCivilDate } from './settlement'
import {
  CARD_TYPES,
  humanizeCardType,
  type CardType,
  type SettlementConfiguration,
  type SettlementDayType,
} from './types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  settlements: SettlementConfiguration[]
  onSaved?: () => void
}

const DEFAULT_DAYS: Record<CardType, number> = { DEBIT: 1, CREDIT: 1, AMEX: 3, INTERNATIONAL: 3 }

export function EditSettlementDrawer({
  open,
  onOpenChange,
  merchantId,
  settlements,
  onSaved,
}: Props) {
  const save = useSaveSettlement()
  const holidaysQ = useHolidays(new Date().getFullYear())
  const holidays = holidaysQ.data ?? new Set<string>()

  const byCard = new Map(settlements.map((s) => [s.cardType, s]))
  const [rows, setRows] = useState(() =>
    CARD_TYPES.map((card) => {
      const s = byCard.get(card)
      return {
        cardType: card,
        settlementDays: s?.settlementDays ?? DEFAULT_DAYS[card],
        settlementDayType: (s?.settlementDayType ?? 'BUSINESS_DAYS') as SettlementDayType,
      }
    }),
  )
  const [cutoffTime, setCutoffTime] = useState(settlements[0]?.cutoffTime || '23:00')
  const [cutoffTimezone] = useState(settlements[0]?.cutoffTimezone || 'America/Mexico_City')
  const [error, setError] = useState<string | null>(null)

  const today = mxCivilToday()
  const existingByCard: Record<string, string> = Object.fromEntries(
    settlements.map((s) => [s.cardType, s.id]),
  )

  function setRow(card: CardType, patch: Partial<(typeof rows)[number]>) {
    setRows((rs) => rs.map((r) => (r.cardType === card ? { ...r, ...patch } : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await save.mutateAsync({
        merchantAccountId: merchantId,
        rows,
        cutoffTime,
        cutoffTimezone,
        existingByCard,
      })
      toast.success('Liquidación actualizada')
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      const i = inspectApiError(err, 'guardar la liquidación')
      setError(i.description)
      toast.error(i.title, { description: i.description })
    }
  }

  const numInput =
    'h-9 w-16 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>Editar liquidación</DrawerTitle>
          <DrawerSubtitle>Días de depósito por tipo de tarjeta.</DrawerSubtitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DrawerBody>
            <div className="flex flex-col gap-3">
              {rows.map((r) => {
                const eta = projectSettlementDate(
                  today,
                  r.settlementDays,
                  r.settlementDayType,
                  holidays,
                )
                return (
                  <div
                    key={r.cardType}
                    className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] py-2 last:border-0"
                  >
                    <span className="w-24 text-[13px] text-[var(--ink-muted)]">
                      {humanizeCardType(r.cardType)}
                    </span>
                    <label className="flex items-center gap-1.5 text-[12px] text-[var(--ink-faint)]">
                      D+
                      <input
                        className={numInput}
                        inputMode="numeric"
                        value={String(r.settlementDays)}
                        onChange={(e) =>
                          setRow(r.cardType, {
                            settlementDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        aria-label={`Días ${humanizeCardType(r.cardType)}`}
                      />
                    </label>
                    <div className="w-36">
                      <Combobox
                        value={r.settlementDayType}
                        onChange={(v) =>
                          setRow(r.cardType, { settlementDayType: v as SettlementDayType })
                        }
                        options={[
                          { value: 'BUSINESS_DAYS', label: 'Hábiles' },
                          { value: 'CALENDAR_DAYS', label: 'Naturales' },
                        ]}
                        ariaLabel={`Tipo de días ${humanizeCardType(r.cardType)}`}
                      />
                    </div>
                    <span className="ml-auto text-[12px] tabular-nums text-[var(--ink)]">
                      {formatCivilDate(eta)}
                    </span>
                  </div>
                )
              })}

              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="cutoff" className="text-[12px] text-[var(--ink-muted)]">
                  Corte
                </label>
                <input
                  id="cutoff"
                  className={numInput.replace('w-16', 'w-24')}
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  placeholder="23:00"
                />
                <span className="text-[12px] text-[var(--ink-faint)]">{cutoffTimezone}</span>
              </div>
              <p className="text-[11.5px] text-[var(--ink-faint)]">
                Estimado: excluye fines de semana
                {holidays.size > 0 ? ' y feriados' : ' (feriados no disponibles)'}. No es la fecha
                real de liquidación.
              </p>
              {error && (
                <p className="text-[13px] text-[var(--danger)]" role="alert">
                  {error}
                </p>
              )}
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
