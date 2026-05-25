import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { getActiveVenuePricing } from './api'
import { MERCHANTS_QUERY_KEY, useSaveVenuePricing } from './use-merchants'
import {
  cardRatesFromCost,
  cardRatesFromPricing,
  type AccountSlot,
  type CardRates,
  type ProviderCostStructure,
} from './types'

const ZERO: CardRates = { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  venueName: string
  slot: AccountSlot
  cost: ProviderCostStructure | null
  onSaved?: () => void
}

export function EditVenuePricingDrawer({
  open,
  onOpenChange,
  venueId,
  venueName,
  slot,
  cost,
  onSaved,
}: Props) {
  const save = useSaveVenuePricing()
  const pricingQ = useQuery({
    queryKey: [...MERCHANTS_QUERY_KEY, 'venue-pricing', venueId, slot],
    queryFn: () => getActiveVenuePricing(venueId, slot),
    enabled: open,
  })
  const loaded = pricingQ.data
  const [rates, setRates] = useState<CardRates>(ZERO)
  const [includesTax, setIncludesTax] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Hidrata el form una vez que carga el pricing (computado en render, sin useEffect).
  if (open && !hydrated && pricingQ.isSuccess) {
    setHydrated(true)
    if (loaded) {
      setRates(cardRatesFromPricing(loaded))
      setIncludesTax(loaded.includesTax ?? true)
    }
  }
  if (!open && hydrated) setHydrated(false)

  const economics = computeMerchantEconomics({
    cost: cost ? cardRatesFromCost(cost) : ZERO,
    venuePrice: rates,
    revenueShare: null,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await save.mutateAsync({
        venueId,
        accountType: slot,
        activeId: loaded?.id ?? null,
        input: {
          rates,
          includesTax,
          taxRate: loaded?.taxRate ?? 0.16,
          fixedFeePerTransaction: loaded?.fixedFeePerTransaction ?? null,
          monthlyServiceFee: loaded?.monthlyServiceFee ?? null,
        },
      })
      toast.success('Pricing actualizado')
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      const i = inspectApiError(err, 'guardar el pricing')
      setError(i.description)
      toast.error(i.title, { description: i.description })
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>Pricing · {venueName}</DrawerTitle>
          <DrawerSubtitle>Lo que paga el venue en el slot {slot}.</DrawerSubtitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DrawerBody>
            <div className="flex flex-col gap-5">
              {pricingQ.isLoading ? (
                <p className="text-[13px] text-[var(--ink-faint)]">Cargando…</p>
              ) : (
                <>
                  <CardRatesInput value={rates} onChange={setRates} idPrefix="vp" />
                  <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                    <input
                      type="checkbox"
                      checked={includesTax}
                      onChange={(e) => setIncludesTax(e.target.checked)}
                    />
                    Las tasas ya incluyen IVA
                  </label>
                  <MarginPreview economics={economics} />
                  {error && (
                    <p className="text-[13px] text-[var(--danger)]" role="alert">
                      {error}
                    </p>
                  )}
                </>
              )}
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || pricingQ.isLoading}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
