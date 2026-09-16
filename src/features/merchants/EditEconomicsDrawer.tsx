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
import { inspectApiError } from '@/shared/lib/api-error'
import { CardRatesInput } from './CardRatesInput'
import { MarginPreview } from './MarginPreview'
import { MoneyFlowDiagram } from './MoneyFlowDiagram'
import { RevenueShareFields } from './RevenueShareFields'
import { computeMerchantEconomics } from './economics'
import { initRevenueShareDraft, revenueShareToInput, type RevenueShareDraft } from './revenue-share'
import { useSaveCost, useSaveRevenueShare } from './use-merchants'
import type { CardRates, MerchantRevenueShare, ProviderCostStructure } from './types'
import { effectiveCardRates, rawCardRates } from './types'

const ZERO: CardRates = { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  cost: ProviderCostStructure | null
  revenueShare: MerchantRevenueShare | null
  onSaved?: () => void
  /** Valores del Asistente de pricing para prellenar (override del estado guardado). */
  initialValues?: {
    rates: CardRates
    includesTax: boolean
    revenueShare: RevenueShareDraft
  }
}

export function EditEconomicsDrawer({ open, onOpenChange, ...form }: Props) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {/* El formulario vive DENTRO del contenido, que Radix monta al abrir y desmonta al
            cerrar: su borrador se siembra en cada apertura con el `cost` / `revenueShare` /
            `initialValues` de ESE momento. Con el estado en el componente de arriba (que la
            página monta desde el primer render, antes de que carguen las queries de
            economía) el borrador se congelaba en la foto vacía: ceros, IVA marcado, 50/70
            (AMAENA T, 2026-09-14). `CardRatesInput` y `PercentInput` ya asumen este
            contrato — "móntalo fresco al abrir el form". */}
        <EconomicsForm onOpenChange={onOpenChange} {...form} />
      </DrawerContent>
    </Drawer>
  )
}

function EconomicsForm({
  onOpenChange,
  merchantId,
  cost,
  revenueShare,
  onSaved,
  initialValues,
}: Omit<Props, 'open'>) {
  const saveCost = useSaveCost()
  const saveRS = useSaveRevenueShare()

  // El campo edita la tasa CRUDA (lo que se persiste); el checkbox decide el IVA.
  const [rates, setRates] = useState<CardRates>(
    initialValues?.rates ?? (cost ? rawCardRates(cost) : ZERO),
  )
  const [includesTax, setIncludesTax] = useState<boolean>(
    initialValues?.includesTax ?? cost?.includesTax ?? true,
  )
  const [rs, setRs] = useState(
    () => initialValues?.revenueShare ?? initRevenueShareDraft(revenueShare),
  )
  const [error, setError] = useState<string | null>(null)

  const taxRate = revenueShare?.taxRate ?? 0.16
  const saving = saveCost.isPending || saveRS.isPending

  const economics = computeMerchantEconomics({
    // La preview necesita la tasa EFECTIVA (con IVA); el estado guarda la cruda.
    cost: effectiveCardRates(rates, includesTax, cost?.taxRate ?? 0.16),
    venuePrice: null,
    revenueShare:
      rs.mode === 'aggregator'
        ? {
            // El precio al agregador entra a la preview en efectivo (con IVA), igual que el costo.
            aggregatorPrice: effectiveCardRates(rs.aggregatorPrice, rs.aggIncludesTax, taxRate),
            avoqadoShareOfProviderMargin: rs.shareProvider,
            avoqadoShareOfAggregatorMargin: rs.shareAgg,
            taxRate,
          }
        : {
            aggregatorPrice: null,
            avoqadoShareOfProviderMargin: rs.shareProvider,
            avoqadoShareOfAggregatorMargin: null,
            taxRate,
          },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await saveCost.mutateAsync({
        merchantAccountId: merchantId,
        activeId: cost?.id ?? null,
        input: {
          rates,
          includesTax,
          taxRate: cost?.taxRate ?? 0.16,
          fixedCostPerTransaction: cost?.fixedCostPerTransaction ?? null,
        },
      })
      await saveRS.mutateAsync({
        merchantAccountId: merchantId,
        existingId: revenueShare?.id ?? null,
        input: revenueShareToInput(rs, taxRate),
      })
      toast.success('Economía actualizada')
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      const i = inspectApiError(err, 'guardar la economía')
      setError(i.description)
      toast.error(i.title, { description: i.description })
    }
  }

  return (
    <>
      <DrawerHeader onClose={() => onOpenChange(false)}>
        <DrawerTitle>Editar economía</DrawerTitle>
        <DrawerSubtitle>Costo del proveedor y reparto del margen.</DrawerSubtitle>
      </DrawerHeader>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <DrawerBody>
          <div className="flex flex-col gap-5">
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-[var(--ink)]">
                Costo del proveedor
              </h3>
              <CardRatesInput value={rates} onChange={setRates} idPrefix="cost" />
              <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                <input
                  type="checkbox"
                  checked={includesTax}
                  onChange={(e) => setIncludesTax(e.target.checked)}
                />
                Las tasas ya incluyen IVA
              </label>
            </section>

            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-[var(--ink)]">Revenue-share</h3>
              <RevenueShareFields value={rs} onChange={setRs} />
            </section>

            <MarginPreview economics={economics} />
            <MoneyFlowDiagram
              economics={economics}
              shares={{
                provider: rs.shareProvider,
                aggregator: rs.mode === 'aggregator' ? rs.shareAgg : null,
              }}
            />
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
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DrawerFooter>
      </form>
    </>
  )
}
