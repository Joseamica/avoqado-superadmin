import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { EconomicsTable } from './EconomicsTable'
import { MoneyFlowDiagram } from './MoneyFlowDiagram'
import { LiquidationCalculatorDialog } from './LiquidationCalculatorDialog'
import { computeMerchantEconomics } from './economics'
import { useVenuePricings } from './use-merchants'
import { cardRatesFromCost, effectiveCardRates, rawCardRates } from './types'
import type {
  MerchantRevenueShare,
  MerchantVenueConfig,
  ProviderCostStructure,
  VenuePricingStructure,
} from './types'

interface SharedProps {
  cost: ProviderCostStructure | null
  revenueShare: MerchantRevenueShare | null
  onEditPricing: (config: MerchantVenueConfig) => void
}

/**
 * Sección "Venues" del detalle del merchant: por cada venue muestra su economía
 * COMPLETA usando el pricing de ESE venue — incluido el tramo agregador→venue
 * (que a nivel merchant no se puede promediar). Aquí se vuelve visible el
 * `avoqadoShareOfAggregatorMargin`.
 */
export function VenueEconomicsSection({
  venueConfigs,
  cost,
  revenueShare,
  onEditPricing,
}: SharedProps & { venueConfigs: MerchantVenueConfig[] }) {
  const pricings = useVenuePricings(venueConfigs.map((c) => ({ venueId: c.venueId, slot: c.slot })))

  if (venueConfigs.length === 0) {
    return (
      <p className="text-[13px] text-[var(--ink-faint)]">
        No está asignada a ningún venue. Asígnala desde el detalle de un venue para definir su
        pricing.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      {venueConfigs.map((vc, i) => (
        <VenueEconomicsCard
          key={`${vc.venueId}-${vc.slot}`}
          config={vc}
          pricing={pricings[i]?.data ?? null}
          loading={pricings[i]?.isLoading ?? false}
          cost={cost}
          revenueShare={revenueShare}
          onEditPricing={onEditPricing}
        />
      ))}
    </div>
  )
}

function VenueEconomicsCard({
  config,
  pricing,
  loading,
  cost,
  revenueShare,
  onEditPricing,
}: SharedProps & {
  config: MerchantVenueConfig
  pricing: VenuePricingStructure | null
  loading: boolean
}) {
  const [calcOpen, setCalcOpen] = useState(false)
  const economics =
    pricing && cost
      ? computeMerchantEconomics({
          cost: cardRatesFromCost(cost),
          venuePrice: effectiveCardRates(
            rawCardRates(pricing),
            pricing.includesTax,
            pricing.taxRate,
          ),
          revenueShare: revenueShare
            ? {
                aggregatorPrice: revenueShare.aggregatorPrice
                  ? effectiveCardRates(
                      revenueShare.aggregatorPrice,
                      revenueShare.aggregatorPriceIncludesTax,
                      revenueShare.taxRate,
                    )
                  : null,
                avoqadoShareOfProviderMargin: revenueShare.avoqadoShareOfProviderMargin,
                avoqadoShareOfAggregatorMargin: revenueShare.avoqadoShareOfAggregatorMargin,
                taxRate: revenueShare.taxRate,
              }
            : null,
        })
      : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            to={`/venues/${config.venueId}`}
            className="text-[13px] font-medium text-[var(--ink)] hover:underline"
          >
            {config.venue.name}
          </Link>
          <Badge tone="muted" size="sm">
            {config.slot}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {economics && (
            <IconButton
              size="sm"
              aria-label={`Calculadora de liquidación de ${config.venue.name}`}
              title="Calculadora de liquidación"
              onClick={() => setCalcOpen(true)}
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden />
            </IconButton>
          )}
          <Button size="sm" variant="ghost" onClick={() => onEditPricing(config)}>
            Editar pricing
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-[var(--ink-faint)]">Cargando pricing…</p>
      ) : !cost ? (
        <p className="text-[13px] text-[var(--ink-faint)]">
          Configura el costo del proveedor para ver el margen de este venue.
        </p>
      ) : !pricing ? (
        <p className="text-[13px] text-[var(--ink-faint)]">
          Sin pricing en el slot {config.slot}. Edita el pricing para definir cuánto paga el venue y
          ver el margen.
        </p>
      ) : economics ? (
        <div className="flex flex-col gap-3">
          <EconomicsTable economics={economics} />
          <MoneyFlowDiagram
            economics={economics}
            shares={
              revenueShare
                ? {
                    provider: revenueShare.avoqadoShareOfProviderMargin,
                    aggregator: revenueShare.avoqadoShareOfAggregatorMargin,
                  }
                : undefined
            }
          />
        </div>
      ) : null}

      {economics && (
        <LiquidationCalculatorDialog
          open={calcOpen}
          onOpenChange={setCalcOpen}
          venueName={config.venue.name}
          economics={economics}
        />
      )}
    </div>
  )
}
