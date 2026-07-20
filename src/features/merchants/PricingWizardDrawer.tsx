import { useMemo, useState } from 'react'
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
import { CardRatesInput } from './CardRatesInput'
import { PercentInput } from './PercentInput'
import { EconomicsTable } from './EconomicsTable'
import {
  EMPTY_WIZARD_STATE,
  buildWizardResult,
  wizardEconomics,
  type WizardState,
  type ChargeModel,
  type WizardResult,
} from './pricing-wizard'
import { CARD_TYPES, rawCardRates, type AccountSlot, type ProviderCostStructure } from './types'

export interface PricingWizardResult {
  result: WizardResult
  venueId: string
  venueName: string
  slot: AccountSlot
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  cost: ProviderCostStructure | null
  venues: { venueId: string; venueName: string; slot: AccountSlot }[]
  onPrefill: (r: PricingWizardResult) => void
}

const asPct = (d: number) => Math.round(d * 10000) / 100

const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'

function initialState(cost: ProviderCostStructure | null, venues: Props['venues']): WizardState {
  return {
    ...EMPTY_WIZARD_STATE,
    cost: cost ? rawCardRates(cost) : EMPTY_WIZARD_STATE.cost,
    costIncludesTax: cost?.includesTax ?? true,
    taxRate: cost?.taxRate ?? 0.16,
    venueId: venues[0]?.venueId ?? '',
  }
}

export function PricingWizardDrawer({ open, onOpenChange, cost, venues, onPrefill }: Props) {
  const [step, setStep] = useState(1)
  const [s, setS] = useState<WizardState>(() => initialState(cost, venues))
  const patch = (p: Partial<WizardState>) => setS((prev) => ({ ...prev, ...p }))

  const economics = useMemo(() => wizardEconomics(s), [s])
  const hasNegative = CARD_TYPES.some((c) => (economics.byCard[c].avoqadoMargin ?? 0) < 0)
  const venue = venues.find((v) => v.venueId === s.venueId) ?? null
  const modelSummary =
    s.model === 'flat'
      ? `El venue paga ${asPct(s.flatRate)}% parejo. Montos por cada $100:`
      : s.model === 'cost-plus'
        ? `El venue paga tu costo + ${asPct(s.markup)}% en cada tarjeta. Montos por cada $100:`
        : 'Desglose de tus dos tramos (proveedor→agregador y agregador→venue). Montos por cada $100:'

  function reset() {
    setStep(1)
    setS(initialState(cost, venues))
  }

  function handlePrefill() {
    if (!venue) return
    onPrefill({
      result: buildWizardResult(s),
      venueId: venue.venueId,
      venueName: venue.venueName,
      slot: venue.slot,
    })
    onOpenChange(false)
    reset()
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>Asistente de pricing</DrawerTitle>
          <DrawerSubtitle>Paso {step} de 3</DrawerSubtitle>
        </DrawerHeader>
        <DrawerBody>
          {step === 1 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-[13px] font-semibold text-[var(--ink)]">
                ¿Cuánto te cobra tu procesador?
              </h3>
              <CardRatesInput
                value={s.cost}
                onChange={(cost) => patch({ cost })}
                idPrefix="wiz-cost"
              />
              <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                <input
                  type="checkbox"
                  checked={s.costIncludesTax}
                  onChange={(e) => patch({ costIncludesTax: e.target.checked })}
                />
                Estas tasas ya incluyen IVA
              </label>
            </section>
          )}

          {step === 2 && (
            <section className="flex flex-col gap-4">
              <div>
                <span className={labelCls}>¿Cómo le cobras al venue?</span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['flat', 'Tasa pareja'],
                      ['cost-plus', 'Costo + comisión'],
                      ['aggregator', 'Vía agregador'],
                    ] as [ChargeModel, string][]
                  ).map(([m, label]) => (
                    <Button
                      key={m}
                      type="button"
                      size="md"
                      variant={s.model === m ? 'primary' : 'secondary'}
                      onClick={() => patch({ model: m })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {s.model === 'flat' && (
                <div>
                  <label htmlFor="wiz-flat" className={labelCls}>
                    % que paga el venue
                  </label>
                  <PercentInput
                    id="wiz-flat"
                    value={s.flatRate}
                    onChange={(flatRate) => patch({ flatRate })}
                  />
                  <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                    <input
                      type="checkbox"
                      checked={s.flatIncludesTax}
                      onChange={(e) => patch({ flatIncludesTax: e.target.checked })}
                    />
                    Ya incluye IVA
                  </label>
                </div>
              )}

              {s.model === 'cost-plus' && (
                <div>
                  <label htmlFor="wiz-markup" className={labelCls}>
                    Tu comisión (%)
                  </label>
                  <PercentInput
                    id="wiz-markup"
                    value={s.markup}
                    onChange={(markup) => patch({ markup })}
                  />
                  <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                    <input
                      type="checkbox"
                      checked={s.markupIncludesTax}
                      onChange={(e) => patch({ markupIncludesTax: e.target.checked })}
                    />
                    Esa comisión lleva IVA
                  </label>
                </div>
              )}

              {s.model === 'aggregator' && (
                <div className="flex flex-col gap-3">
                  <div>
                    <span className={labelCls}>Precio base al venue (antes de tu markup)</span>
                    <CardRatesInput
                      value={s.aggregatorPrice}
                      onChange={(aggregatorPrice) => patch({ aggregatorPrice })}
                      idPrefix="wiz-agg"
                    />
                    <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                      <input
                        type="checkbox"
                        checked={s.aggIncludesTax}
                        onChange={(e) => patch({ aggIncludesTax: e.target.checked })}
                      />
                      Ya incluye IVA
                    </label>
                  </div>
                  <div>
                    <label htmlFor="wiz-agg-sp" className={labelCls}>
                      Del margen (tu costo → precio base), ¿qué % es tuyo?
                    </label>
                    <PercentInput
                      id="wiz-agg-sp"
                      value={s.aggShareProvider}
                      onChange={(aggShareProvider) => patch({ aggShareProvider })}
                    />
                  </div>
                  <div>
                    <label htmlFor="wiz-agg-markup" className={labelCls}>
                      Tu markup encima del precio base (%)
                    </label>
                    <PercentInput
                      id="wiz-agg-markup"
                      value={s.aggMarkup}
                      onChange={(aggMarkup) => patch({ aggMarkup })}
                    />
                    <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                      <input
                        type="checkbox"
                        checked={!s.aggMarkupIncludesTax}
                        onChange={(e) => patch({ aggMarkupIncludesTax: !e.target.checked })}
                      />
                      Súmale IVA a tu markup
                    </label>
                  </div>
                  <div>
                    <label htmlFor="wiz-agg-sa" className={labelCls}>
                      De tu markup, ¿qué % es tuyo?
                    </label>
                    <PercentInput
                      id="wiz-agg-sa"
                      value={s.aggShareAggregator}
                      onChange={(aggShareAggregator) => patch({ aggShareAggregator })}
                    />
                  </div>
                </div>
              )}

              {(s.model === 'flat' || s.model === 'cost-plus') && (
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                    <input
                      type="checkbox"
                      checked={s.hasPartner}
                      onChange={(e) =>
                        patch({
                          hasPartner: e.target.checked,
                          avoqadoShare: e.target.checked ? 0.5 : 1,
                        })
                      }
                    />
                    Reparto mi ganancia con un socio
                  </label>
                  {s.hasPartner && (
                    <div>
                      <label htmlFor="wiz-share" className={labelCls}>
                        % que es tuyo
                      </label>
                      <PercentInput
                        id="wiz-share"
                        value={s.avoqadoShare}
                        onChange={(avoqadoShare) => patch({ avoqadoShare })}
                      />
                    </div>
                  )}
                  {s.model === 'cost-plus' && s.hasPartner && (
                    <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                      <input
                        type="checkbox"
                        checked={s.markupIsNet}
                        onChange={(e) => patch({ markupIsNet: e.target.checked })}
                      />
                      Esa comisión es lo que quiero ganar limpio (no la que reparto)
                    </label>
                  )}
                </div>
              )}
            </section>
          )}

          {step === 3 && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-[12px] text-[var(--ink-muted)]">{modelSummary}</p>
                <EconomicsTable economics={economics} />
              </div>
              {hasNegative && (
                <p className="text-[12px] text-[var(--warn)]" role="alert">
                  Ojo: alguna tarjeta sale con margen negativo — pierdes en esa tarjeta.
                </p>
              )}
              {venues.length === 0 ? (
                <p className="text-[13px] text-[var(--ink-faint)]">
                  Este merchant no está asignado a ningún venue todavía. Asígnalo desde el detalle
                  de un venue para poder aplicarle este pricing.
                </p>
              ) : (
                <div>
                  <span className={labelCls}>¿A qué venue le aplico este pricing?</span>
                  <Combobox
                    value={s.venueId}
                    onChange={(v) => patch({ venueId: v })}
                    options={venues.map((v) => ({
                      value: v.venueId,
                      label: `${v.venueName} · ${v.slot}`,
                    }))}
                    placeholder="Elegir venue"
                    ariaLabel="Venue destino"
                  />
                </div>
              )}
            </section>
          )}
        </DrawerBody>
        <DrawerFooter>
          {step > 1 && (
            <Button type="button" variant="ghost" onClick={() => setStep((n) => n - 1)}>
              Atrás
            </Button>
          )}
          {step < 3 ? (
            <Button type="button" size="lg" onClick={() => setStep((n) => n + 1)}>
              Siguiente
            </Button>
          ) : (
            <Button type="button" size="lg" disabled={!venue} onClick={handlePrefill}>
              Prellenar y revisar
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
