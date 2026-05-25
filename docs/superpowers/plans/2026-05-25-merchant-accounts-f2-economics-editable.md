# Merchant Accounts — F2: Economía editable · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Volver editable la economía del merchant — costo del proveedor + split (revenue-share) a nivel merchant, y pricing por venue/slot — con preview de margen en vivo, sobre endpoints `/api/v1/superadmin/*`.

**Architecture:** Extiende `src/features/merchants/`. Dos primitivos nuevos del feature (`CardRatesInput` en %, `MarginPreview` que envuelve `economics.ts`), reusados por dos drawers (`EditEconomicsDrawer`, `EditVenuePricingDrawer`). Editar en sitio: `PUT` la estructura activa, `POST` si no existe. Mutaciones invalidan `['superadmin','merchants']`.

**Tech Stack:** React 18 + TS · TanStack Query · zod · sonner · Drawer/Dialog/Button/Combobox del design system · Vitest + RTL + MSW.

**Spec:** `docs/superpowers/specs/2026-05-25-merchant-accounts-f2-economics-editable-design.md`. **Restricción:** branch `develop`, sin worktree/branch, **sin commit**, sin `npm run format` global (sólo `npx prettier --write "src/features/merchants/**"`).

---

## Convenciones clave

- **% en UI, decimal en API.** `CardRatesInput` muestra/edita porcentaje; convierte `÷100` al emitir (decimal 0..1) y `×100` al cargar. Redondeo a 2 decimales de % para evitar ruido float (`Math.round(dec*10000)/100`).
- **Editar en sitio:** si la estructura activa existe → `PUT /:id`; si no → `POST` con `effectiveFrom = new Date().toISOString()`.
- Reusa de F1: `api`, `mapMerchant`, `fetchActiveCost`, `fetchRevenueShare`, `MERCHANTS_QUERY_KEY`, `economics.ts`, `inspectApiError`, `inputCls`-style inputs, `Drawer*`, `Button`, `Combobox`.

---

# Parte F2·A — Costo + Split + Preview

## Task A1: `CardRatesInput` (primitive, %↔decimal) — TDD

**Files:** Create `src/features/merchants/CardRatesInput.tsx` + `CardRatesInput.test.tsx`

- [ ] **Step 1: Test primero**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CardRatesInput } from './CardRatesInput'
import type { CardRates } from './types'

const rates: CardRates = { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 }

describe('CardRatesInput', () => {
  it('muestra las tasas como porcentaje', () => {
    render(<CardRatesInput value={rates} onChange={() => {}} idPrefix="cost" />)
    expect((screen.getByLabelText('Débito (%)') as HTMLInputElement).value).toBe('1.5')
    expect((screen.getByLabelText('Crédito (%)') as HTMLInputElement).value).toBe('2.5')
  })

  it('emite decimal al escribir porcentaje', () => {
    const onChange = vi.fn()
    render(<CardRatesInput value={rates} onChange={onChange} idPrefix="cost" />)
    fireEvent.change(screen.getByLabelText('Débito (%)'), { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith({ ...rates, DEBIT: 0.02 })
  })

  it('input vacío = 0', () => {
    const onChange = vi.fn()
    render(<CardRatesInput value={rates} onChange={onChange} idPrefix="cost" />)
    fireEvent.change(screen.getByLabelText('AMEX (%)'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({ ...rates, AMEX: 0 })
  })
})
```

- [ ] **Step 2: Correr → FAIL.** `npx vitest run src/features/merchants/CardRatesInput.test.tsx`

- [ ] **Step 3: Implementar**

```tsx
import { useState } from 'react'
import { CARD_TYPES, humanizeCardType, type CardRates, type CardType } from './types'

const toPct = (dec: number): string => {
  if (!Number.isFinite(dec)) return ''
  return String(Math.round(dec * 10000) / 100) // 0.015 -> "1.5"
}

const inputCls =
  'h-9 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums ' +
  'placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

/**
 * Cuatro inputs de tasa por tipo de tarjeta, en PORCENTAJE. El value es
 * `CardRates` en decimal (0..1); internamente muestra `×100` y emite `÷100`.
 * Mantiene un buffer de texto para permitir escritura parcial ("1.", "").
 * Móntalo fresco al abrir el form (el Drawer lo desmonta al cerrar) para que
 * el buffer se inicialice del value cargado.
 */
export function CardRatesInput({
  value,
  onChange,
  idPrefix,
}: {
  value: CardRates
  onChange: (next: CardRates) => void
  idPrefix: string
}) {
  const [text, setText] = useState<Record<CardType, string>>(() => ({
    DEBIT: toPct(value.DEBIT),
    CREDIT: toPct(value.CREDIT),
    AMEX: toPct(value.AMEX),
    INTERNATIONAL: toPct(value.INTERNATIONAL),
  }))

  function handle(card: CardType, raw: string) {
    setText((t) => ({ ...t, [card]: raw }))
    const parsed = raw.trim() === '' ? 0 : parseFloat(raw) / 100
    onChange({ ...value, [card]: Number.isFinite(parsed) ? parsed : 0 })
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {CARD_TYPES.map((card) => {
        const id = `${idPrefix}-${card}`
        return (
          <div key={card}>
            <label htmlFor={id} className="mb-1 block text-[11px] text-[var(--ink-muted)]">
              {humanizeCardType(card)} (%)
            </label>
            <input
              id={id}
              className={inputCls}
              inputMode="decimal"
              value={text[card]}
              onChange={(e) => handle(card, e.target.value)}
            />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Correr → PASS.** Then `npx tsc --noEmit`. (No commit.)

---

## Task A2: `MarginPreview` — TDD

**Files:** Create `src/features/merchants/MarginPreview.tsx` + `MarginPreview.test.tsx`

- [ ] **Step 1: Test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarginPreview } from './MarginPreview'
import { computeMerchantEconomics } from './economics'

describe('MarginPreview', () => {
  it('muestra el margen por tarjeta en modo all-avoqado', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: { DEBIT: 0.02, CREDIT: 0.03, AMEX: 0.04, INTERNATIONAL: 0.045 },
      revenueShare: null,
    })
    render(<MarginPreview economics={eco} />)
    expect(screen.getByText('Margen Avoqado (por $100)')).toBeInTheDocument()
    // débito margen 0.50
    expect(screen.getByText('$0.50')).toBeInTheDocument()
  })

  it('explica que falta pricing en no-pricing', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: null,
      revenueShare: null,
    })
    render(<MarginPreview economics={eco} />)
    expect(screen.getByText(/define el pricing/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr → FAIL.**

- [ ] **Step 3: Implementar**

```tsx
import { CARD_TYPES, humanizeCardType } from './types'
import type { MerchantEconomics } from './economics'

const money = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

/** Preview compacto del margen Avoqado por tarjeta. Lee el MerchantEconomics ya computado. */
export function MarginPreview({ economics }: { economics: MerchantEconomics }) {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas-sunken)] p-3">
      <p className="mb-2 text-[12px] font-medium text-[var(--ink)]">Margen Avoqado (por $100)</p>
      {economics.mode === 'no-pricing' ? (
        <p className="text-[12px] text-[var(--ink-faint)]">
          Sin pricing — define el pricing por venue para ver el margen directo.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          {CARD_TYPES.map((c) => (
            <div key={c} className="flex items-baseline justify-between">
              <dt className="text-[12px] text-[var(--ink-muted)]">{humanizeCardType(c)}</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-[var(--success)]">
                {money(economics.byCard[c].avoqadoMargin)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Correr → PASS.** `npx tsc --noEmit`.

---

## Task A3: api.ts — guardar costo + revenue-share

**Files:** Modify `src/features/merchants/api.ts`

- [ ] **Step 1: Append**

```ts
/* --- Mutations economía (F2) --- */

export interface SaveCostInput {
  rates: CardRates
  includesTax: boolean
  taxRate: number
  fixedCostPerTransaction?: number | null
}

/** PUT la estructura activa si `activeId`, si no POST una nueva (effectiveFrom=ahora). */
export async function saveCost(
  merchantAccountId: string,
  activeId: string | null,
  input: SaveCostInput,
): Promise<void> {
  const body = {
    merchantAccountId,
    debitRate: input.rates.DEBIT,
    creditRate: input.rates.CREDIT,
    amexRate: input.rates.AMEX,
    internationalRate: input.rates.INTERNATIONAL,
    includesTax: input.includesTax,
    taxRate: input.taxRate,
    fixedCostPerTransaction: input.fixedCostPerTransaction ?? undefined,
  }
  if (activeId) {
    await api.put(`/superadmin/cost-structures/${encodeURIComponent(activeId)}`, body)
  } else {
    await api.post('/superadmin/cost-structures', {
      ...body,
      effectiveFrom: new Date().toISOString(),
    })
  }
}

export interface SaveRevenueShareInput {
  aggregatorPrice: CardRates | null
  avoqadoShareOfProviderMargin: number
  avoqadoShareOfAggregatorMargin: number | null
  taxRate: number
}

export async function saveRevenueShare(
  merchantAccountId: string,
  existingId: string | null,
  input: SaveRevenueShareInput,
): Promise<void> {
  const body = {
    aggregatorPrice: input.aggregatorPrice,
    aggregatorPriceIncludesTax: false,
    avoqadoShareOfProviderMargin: input.avoqadoShareOfProviderMargin,
    avoqadoShareOfAggregatorMargin: input.avoqadoShareOfAggregatorMargin,
    taxRate: input.taxRate,
    active: true,
  }
  if (existingId) {
    await api.put(`/superadmin/merchant-revenue-shares/${encodeURIComponent(existingId)}`, body)
  } else {
    await api.post('/superadmin/merchant-revenue-shares', { ...body, merchantAccountId })
  }
}
```

- [ ] **Step 2:** `npx tsc --noEmit` → clean.

---

## Task A4: use-merchants.ts — hooks de guardado (costo + split)

**Files:** Modify `src/features/merchants/use-merchants.ts`

- [ ] **Step 1:** Añade a los imports de `./api`: `saveCost, saveRevenueShare, type SaveCostInput, type SaveRevenueShareInput`. Append:

```ts
export function useSaveCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      merchantAccountId: string
      activeId: string | null
      input: SaveCostInput
    }) => saveCost(vars.merchantAccountId, vars.activeId, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useSaveRevenueShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      merchantAccountId: string
      existingId: string | null
      input: SaveRevenueShareInput
    }) => saveRevenueShare(vars.merchantAccountId, vars.existingId, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}
```

- [ ] **Step 2:** `npx tsc --noEmit` → clean.

---

## Task A5: `EditEconomicsDrawer` + test

**Files:** Create `src/features/merchants/EditEconomicsDrawer.tsx` + `EditEconomicsDrawer.test.tsx`

- [ ] **Step 1: Implementar el drawer**

```tsx
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
  /** Estructura de costo activa (o null si no hay). */
  cost: ProviderCostStructure | null
  /** Revenue-share existente (o null). */
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
```

- [ ] **Step 2: Test (MSW)** — `EditEconomicsDrawer.test.tsx`: render con `cost` y `revenueShare` provistos (props directas, sin fetch); MSW para `PUT /superadmin/cost-structures/:id` y `PUT /superadmin/merchant-revenue-shares/:id` (capturan el body); edita débito a `2` (%); submit; **assert que el body del PUT de costo trae `debitRate: 0.02`** (la conversión %→decimal), y que sale el toast. Usa `renderWithProviders`.

- [ ] **Step 3: Correr → PASS.** `npx tsc --noEmit`.

---

## Task A6: Wire `EditEconomicsDrawer` en el detalle

**Files:** Modify `src/features/merchants/MerchantDetailPage.tsx`

- [ ] **Step 1:** Importa `useState` (ya está), `EditEconomicsDrawer`. Añade `const [editingEco, setEditingEco] = useState(false)`. En la sección **Economía** (el `<Section title="Economía (por tarjeta)">` o el header del Overview de economía), agrega un `<Button size="sm" variant="secondary" onClick={() => setEditingEco(true)}>Editar economía</Button>`. Renderiza al final del Shell:

```tsx
<EditEconomicsDrawer
  open={editingEco}
  onOpenChange={setEditingEco}
  merchantId={m.id}
  cost={eco.cost}
  revenueShare={eco.revenueShare}
  onSaved={eco.refetch}
/>
```

(`eco.cost` y `eco.revenueShare` ya los expone `useMerchantEconomicsData` de F1.)

- [ ] **Step 2:** `npx vitest run src/features/merchants` + `npx tsc --noEmit` → verdes (no romper el test de detalle existente).

---

## Task A7: Server `logAction` — costo + revenue-share

**Files:** Modify `avoqado-server/src/controllers/superadmin/providerCostStructure.controller.ts`, `avoqado-server/src/controllers/superadmin/merchantRevenueShare.controller.ts`

> Aditivo, **sin commit**, deploy-first. Editar SÓLO esos 2 archivos.

- [ ] **Step 1:** Copia el patrón de `logAction` de `merchantAccount.controller.ts` (import desde `../../services/dashboard/activity-log.service`, `staffId: (req as any).user?.uid`). En `createProviderCostStructure` y `updateProviderCostStructure` agrega `await logAction({ staffId, action: 'COST_STRUCTURE_CREATED'|'COST_STRUCTURE_UPDATED', entity: 'ProviderCostStructure', entityId: <id>, data: { merchantAccountId, debitRate, creditRate, amexRate, internationalRate }, ipAddress: req.ip, userAgent: req.headers['user-agent'] })`. En `merchantRevenueShare.controller.ts` (`createMerchantRevenueShare`, `updateMerchantRevenueShare`) → `REVENUE_SHARE_CREATED`/`_UPDATED`, entity `MerchantRevenueShare`, `data: { merchantAccountId, mode: aggregatorPrice ? 'aggregator' : 'direct' }`. **Nunca** loguear credenciales.

- [ ] **Step 2:** `cd avoqado-server && npx tsc --noEmit` → no new errors. `git status --porcelain` confirma sólo esos 2 archivos nuevos en el set. No commit.

---

# Parte F2·B — Venue pricing

## Task B1: type + api + hook de venue pricing

**Files:** Modify `src/features/merchants/types.ts`, `api.ts`, `use-merchants.ts`

- [ ] **Step 1: types.ts — append**

```ts
export interface VenuePricingStructure {
  id: string
  venueId: string
  accountType: AccountSlot
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax: boolean | null
  taxRate: number
  fixedFeePerTransaction: number | null
  monthlyServiceFee: number | null
  effectiveFrom: string
  effectiveTo: string | null
  active: boolean
}

export function cardRatesFromPricing(p: VenuePricingStructure): CardRates {
  return {
    DEBIT: effectiveRate(p.debitRate, p.includesTax, p.taxRate),
    CREDIT: effectiveRate(p.creditRate, p.includesTax, p.taxRate),
    AMEX: effectiveRate(p.amexRate, p.includesTax, p.taxRate),
    INTERNATIONAL: effectiveRate(p.internationalRate, p.includesTax, p.taxRate),
  }
}
```

- [ ] **Step 2: api.ts — append** (verifica nombres del body leyendo `venuePricing.controller.ts`):

```ts
export async function getActiveVenuePricing(
  venueId: string,
  accountType: AccountSlot,
): Promise<VenuePricingStructure | null> {
  try {
    const { data } = await api.get<{ data: Record<string, unknown> | null }>(
      `/superadmin/venue-pricing/structures/active/${encodeURIComponent(venueId)}/${accountType}`,
    )
    const p = data?.data
    if (!p) return null
    return {
      id: String(p.id),
      venueId,
      accountType,
      debitRate: num(p.debitRate),
      creditRate: num(p.creditRate),
      amexRate: num(p.amexRate),
      internationalRate: num(p.internationalRate),
      includesTax: (p.includesTax as boolean | null) ?? null,
      taxRate: num(p.taxRate, 0.16),
      fixedFeePerTransaction:
        p.fixedFeePerTransaction == null ? null : num(p.fixedFeePerTransaction),
      monthlyServiceFee: p.monthlyServiceFee == null ? null : num(p.monthlyServiceFee),
      effectiveFrom: String(p.effectiveFrom),
      effectiveTo: (p.effectiveTo as string | null) ?? null,
      active: (p.active as boolean) ?? true,
    }
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null
    throw error
  }
}

export interface SaveVenuePricingInput {
  rates: CardRates
  includesTax: boolean
  taxRate: number
  fixedFeePerTransaction?: number | null
  monthlyServiceFee?: number | null
}

export async function saveVenuePricing(
  venueId: string,
  accountType: AccountSlot,
  activeId: string | null,
  input: SaveVenuePricingInput,
): Promise<void> {
  const body = {
    venueId,
    accountType,
    debitRate: input.rates.DEBIT,
    creditRate: input.rates.CREDIT,
    amexRate: input.rates.AMEX,
    internationalRate: input.rates.INTERNATIONAL,
    includesTax: input.includesTax,
    taxRate: input.taxRate,
    fixedFeePerTransaction: input.fixedFeePerTransaction ?? undefined,
    monthlyServiceFee: input.monthlyServiceFee ?? undefined,
  }
  if (activeId)
    await api.put(`/superadmin/venue-pricing/structures/${encodeURIComponent(activeId)}`, body)
  else
    await api.post('/superadmin/venue-pricing/structures', {
      ...body,
      effectiveFrom: new Date().toISOString(),
    })
}
```

(Importa `AccountSlot`, `VenuePricingStructure` en api.ts.)

- [ ] **Step 3: use-merchants.ts — append**

```ts
export function useSaveVenuePricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      venueId: string
      accountType: AccountSlot
      activeId: string | null
      input: SaveVenuePricingInput
    }) => saveVenuePricing(vars.venueId, vars.accountType, vars.activeId, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}
```

(Importa `saveVenuePricing`, `getActiveVenuePricing`, `type SaveVenuePricingInput`, `type AccountSlot`.)

- [ ] **Step 4:** `npx tsc --noEmit` → clean.

---

## Task B2: `EditVenuePricingDrawer` + test

**Files:** Create `src/features/merchants/EditVenuePricingDrawer.tsx` + test

- [ ] **Step 1: Implementar.** Carga `getActiveVenuePricing(venueId, slot)` con `useQuery` (key `[...MERCHANTS_QUERY_KEY,'venue-pricing',venueId,slot]`) + recibe el `cost` activo del merchant por prop para el preview. Form: `CardRatesInput` + includesTax + fixedFee + monthlyFee. Preview vía `computeMerchantEconomics({ cost: cardRatesFromCost(cost) | ZERO, venuePrice: rates, revenueShare: null })` → margen directo. Guarda con `useSaveVenuePricing`. Estructura idéntica al `EditEconomicsDrawer` (header/body/footer/toast/inspectApiError). Props: `{ open, onOpenChange, venueId, venueName, slot, cost, onSaved? }`.

```tsx
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
```

- [ ] **Step 2: Test (MSW):** render con `open`, `cost` provisto; MSW `GET …/venue-pricing/structures/active/:venueId/:slot` → null (caso sin pricing) y `POST …/venue-pricing/structures` capturando body; edita débito a `3`%; submit; assert el POST con `debitRate: 0.03` + `effectiveFrom` presente + `accountType` correcto + toast. (Caso "no existe" → POST.)

- [ ] **Step 3: Correr → PASS.** `npx tsc --noEmit`.

---

## Task B3: Wire `EditVenuePricingDrawer` en la sección Venues

**Files:** Modify `src/features/merchants/MerchantDetailPage.tsx`

- [ ] **Step 1:** En la sección Venues, por cada fila (`eco.venueConfigs.map`) agrega un `<Button size="sm" variant="ghost">Editar pricing</Button>` que setea `const [pricingTarget, setPricingTarget] = useState<{venueId:string; venueName:string; slot:AccountSlot}|null>(null)`. Renderiza un único `EditVenuePricingDrawer` controlado por `pricingTarget` (open = `!!pricingTarget`), pasando `cost={eco.cost}` y `onSaved={eco.refetch}`. Importa `AccountSlot` de `./types`.

- [ ] **Step 2:** `npx vitest run src/features/merchants` + `npx tsc --noEmit` → verdes (no romper el test de detalle).

---

## Task B4: Server `logAction` — venue pricing

**Files:** Modify `avoqado-server/src/controllers/superadmin/venuePricing.controller.ts`

- [ ] **Step 1:** Mismo patrón: en los handlers create/update de `VenuePricingStructure`, `await logAction({ staffId: (req as any).user?.uid, action: 'VENUE_PRICING_CREATED'|'VENUE_PRICING_UPDATED', entity: 'VenuePricingStructure', entityId: <id>, data: { venueId, accountType, debitRate, creditRate, amexRate, internationalRate }, ipAddress: req.ip, userAgent: req.headers['user-agent'] })`. Sólo ese archivo. Sin commit.

- [ ] **Step 2:** `cd avoqado-server && npx tsc --noEmit` → clean.

---

## Task F2-FINAL: Docs + gate

**Files:** Modify `CHANGELOG.md`

- [ ] **Step 1:** CHANGELOG `[Unreleased] · Added`: "Merchant accounts (F2): edición de costo del proveedor, revenue-share (split) y pricing por venue/slot con preview de margen en vivo; `logAction` server-side en cost-structures/venue-pricing/revenue-shares."
- [ ] **Step 2:** `npx prettier --write "src/features/merchants/**/*.{ts,tsx}"`. Luego `npm run check` + `npm run build` → todo verde.
- [ ] **Step 3:** `impeccable:audit` (controller) — arreglar ≥ high.

---

## Self-review (cobertura del spec)

- §2 editar costo → A3/A5; revenue-share → A3/A5; venue pricing → B1/B2/B3; preview en vivo → A2 (`MarginPreview`) usado por ambos drawers; logAction → A7/B4.
- §3 editar-en-sitio (PUT/POST-si-no-existe) → `saveCost`/`saveRevenueShare`/`saveVenuePricing`. §4 contratos → A3/B1. §6 %↔decimal → A1 (`CardRatesInput`) + tests que afirman `2.5% → 0.025`.
- §5 archivos → coinciden. §9 testing → tests por task. Tipos consistentes: `CardRates`, `SaveCostInput`, `SaveRevenueShareInput`, `SaveVenuePricingInput`, `VenuePricingStructure`, `cardRatesFromCost`/`cardRatesFromPricing`.
- Abierto (§10): nombres exactos del body de venue-pricing — B1 Step 2 marca "verifica leyendo el controller".
