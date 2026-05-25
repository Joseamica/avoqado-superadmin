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
import { computeMerchantEconomics } from './economics'
import { useSaveCost, useSaveRevenueShare } from './use-merchants'
import type { CardRates, MerchantRevenueShare, ProviderCostStructure } from './types'
import { cardRatesFromCost } from './types'

const ZERO: CardRates = { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  cost: ProviderCostStructure | null
  revenueShare: MerchantRevenueShare | null
  onSaved?: () => void
}

export function EditEconomicsDrawer({
  open,
  onOpenChange,
  merchantId,
  cost,
  revenueShare,
  onSaved,
}: Props) {
  const saveCost = useSaveCost()
  const saveRS = useSaveRevenueShare()

  const [rates, setRates] = useState<CardRates>(cost ? cardRatesFromCost(cost) : ZERO)
  const [includesTax, setIncludesTax] = useState<boolean>(cost?.includesTax ?? true)
  const [mode, setMode] = useState<'direct' | 'aggregator'>(
    revenueShare?.aggregatorPrice ? 'aggregator' : 'direct',
  )
  const [aggPrice, setAggPrice] = useState<CardRates>(revenueShare?.aggregatorPrice ?? ZERO)
  const [shareProvider, setShareProvider] = useState<number>(
    revenueShare?.avoqadoShareOfProviderMargin ?? 0.5,
  )
  const [shareAgg, setShareAgg] = useState<number>(
    revenueShare?.avoqadoShareOfAggregatorMargin ?? 0.7,
  )
  const [error, setError] = useState<string | null>(null)

  const saving = saveCost.isPending || saveRS.isPending

  const economics = computeMerchantEconomics({
    cost: rates,
    venuePrice: null,
    revenueShare:
      mode === 'aggregator'
        ? {
            aggregatorPrice: aggPrice,
            avoqadoShareOfProviderMargin: shareProvider,
            avoqadoShareOfAggregatorMargin: shareAgg,
            taxRate: revenueShare?.taxRate ?? 0.16,
          }
        : {
            aggregatorPrice: null,
            avoqadoShareOfProviderMargin: shareProvider,
            avoqadoShareOfAggregatorMargin: null,
            taxRate: revenueShare?.taxRate ?? 0.16,
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
        input: {
          aggregatorPrice: mode === 'aggregator' ? aggPrice : null,
          avoqadoShareOfProviderMargin: shareProvider,
          avoqadoShareOfAggregatorMargin: mode === 'aggregator' ? shareAgg : null,
          taxRate: revenueShare?.taxRate ?? 0.16,
        },
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

  const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'
  const pctInput =
    'h-9 w-24 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
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
                <div className="mb-3 flex gap-4 text-[13px]">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="rs-mode"
                      checked={mode === 'direct'}
                      onChange={() => setMode('direct')}
                    />{' '}
                    Directa
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="rs-mode"
                      checked={mode === 'aggregator'}
                      onChange={() => setMode('aggregator')}
                    />{' '}
                    Vía agregador
                  </label>
                </div>
                {mode === 'aggregator' && (
                  <div className="mb-3">
                    <span className={labelCls}>Precio al agregador</span>
                    <CardRatesInput value={aggPrice} onChange={setAggPrice} idPrefix="agg" />
                  </div>
                )}
                <div className="flex flex-wrap gap-4">
                  <div>
                    <label htmlFor="shp" className={labelCls}>
                      Avoqado del margen proveedor (%)
                    </label>
                    <input
                      id="shp"
                      className={pctInput}
                      inputMode="decimal"
                      value={String(Math.round(shareProvider * 10000) / 100)}
                      onChange={(e) => setShareProvider((parseFloat(e.target.value) || 0) / 100)}
                    />
                  </div>
                  {mode === 'aggregator' && (
                    <div>
                      <label htmlFor="sha" className={labelCls}>
                        Avoqado del margen agregador (%)
                      </label>
                      <input
                        id="sha"
                        className={pctInput}
                        inputMode="decimal"
                        value={String(Math.round(shareAgg * 10000) / 100)}
                        onChange={(e) => setShareAgg((parseFloat(e.target.value) || 0) / 100)}
                      />
                    </div>
                  )}
                </div>
              </section>

              <MarginPreview economics={economics} />
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
      </DrawerContent>
    </Drawer>
  )
}
