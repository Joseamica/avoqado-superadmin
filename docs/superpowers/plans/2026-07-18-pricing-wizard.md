# Asistente de pricing (Pricing Wizard) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un asistente guiado que pregunta en español plano cómo le cobras al venue (flat / cost-plus / agregador), calcula todos los números y prellena los drawers de economía y pricing para que el operador solo confirme con Guardar.

**Architecture:** Toda la matemática vive en una función pura nueva (`pricing-wizard.ts`) que traduce el estado del wizard → los 3 payloads crudos que ya consumen las mutations existentes (`saveCost`, `saveRevenueShare`, `saveVenuePricing`), y reutiliza `computeMerchantEconomics` para el preview. La UI es un `Drawer` con stepper de 3 pasos. Al terminar, prellena los drawers existentes (que ganan un prop `initialValues` opcional) y los abre en secuencia para que el operador confirme. Cero backend nuevo.

**Tech Stack:** React 18 + TypeScript strict, TanStack Query, Vitest 4 + React Testing Library + MSW, Tailwind v4, primitives del repo (`Drawer`, `Combobox`, `Button`, `CardRatesInput`).

## Global Constraints

- **Tasas en decimal** (0..1): `CardRates` guarda `0.035` para 3.5 %. `CardRatesInput` ya muestra ×100 y emite ÷100. Los shares también son decimales (`0.5` = 50 %). `taxRate` default `0.16`.
- **Namespace:** el front solo consume `/api/v1/superadmin/*`. Este plan NO agrega endpoints — reutiliza las mutations existentes.
- **Aditivo:** los props nuevos en `EditEconomicsDrawer` / `EditVenuePricingDrawer` son opcionales; no rompen los usos actuales.
- **No `useEffect` para estado derivado** — computar en render (patrón del repo).
- **Errores en UI** → `inspectApiError` + `toast.error` (mutations) o `<QueryError>` (queries). Nunca `<div>No pudimos…</div>`.
- **Diseño:** dark theme default; reusar primitives (`Button`, `Badge`, `Combobox`, `CardRatesInput`); nunca `<select>` nativo ni clases de botón inline. Aplicar `impeccable:frontend-design` al construir y `impeccable:audit` antes de push (regla del repo).
- **Git:** trabajar en `develop`; confirmar con el usuario antes de commitear si el árbol tiene cambios sin relacionar (regla del repo). Los steps de commit abajo asumen que ya se confirmó.
- **Antes de declarar terminado:** `PATH="/opt/homebrew/bin:$PATH" npm run check` (lint + typecheck + tests) y `npm run build` en verde. Node ^22.12 || >=24.
- **Docs obligatorias en el mismo PR:** entrada en `CHANGELOG.md` (`[Unreleased]`) y actualización de `README.md` si cambia una acción top-level (sí cambia: nueva acción en el detalle del merchant).

---

## File Structure

- **Create** `src/features/merchants/pricing-wizard.ts` — estado del wizard + traducción pura a payloads + `wizardEconomics` para el preview.
- **Create** `src/features/merchants/pricing-wizard.test.ts` — unit de la traducción y el preview.
- **Create** `src/features/merchants/PricingWizardDrawer.tsx` — el drawer stepper de 3 pasos.
- **Create** `src/features/merchants/PricingWizardDrawer.test.tsx` — component + MSW.
- **Modify** `src/features/merchants/EditEconomicsDrawer.tsx` — prop `initialValues?` opcional.
- **Modify** `src/features/merchants/EditVenuePricingDrawer.tsx` — prop `initialValues?` opcional.
- **Modify** `src/features/merchants/MerchantDetailPage.tsx` — botón lanzador + orquestación del prellenado secuencial.
- **Modify** `CHANGELOG.md`, `README.md`.

---

## Task 1: Lógica pura del wizard (`pricing-wizard.ts`)

**Files:**
- Create: `src/features/merchants/pricing-wizard.ts`
- Test: `src/features/merchants/pricing-wizard.test.ts`

**Interfaces:**
- Consumes: `CardRates`, `CardType`, `CARD_TYPES` de `./types`; `SaveCostInput`, `SaveRevenueShareInput`, `SaveVenuePricingInput` de `./api`; `computeMerchantEconomics`, `MerchantEconomics` de `./economics`.
- Produces:
  - `type ChargeModel = 'flat' | 'cost-plus' | 'aggregator'`
  - `interface WizardState { … }` (ver código)
  - `interface WizardResult { costInput; revenueShareInput; venuePricingInput }`
  - `function buildWizardResult(s: WizardState): WizardResult`
  - `function wizardEconomics(s: WizardState): MerchantEconomics`
  - `const EMPTY_WIZARD_STATE: WizardState`

- [ ] **Step 1: Write the failing test**

Create `src/features/merchants/pricing-wizard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildWizardResult, wizardEconomics, EMPTY_WIZARD_STATE, type WizardState } from './pricing-wizard'

// Costos reales del caso Berthe (base, +IVA): 1.68 / 2.05 / 3 / 3.3
const base: WizardState = {
  ...EMPTY_WIZARD_STATE,
  cost: { DEBIT: 0.0168, CREDIT: 0.0205, AMEX: 0.03, INTERNATIONAL: 0.033 },
  costIncludesTax: false,
  taxRate: 0.16,
  venueId: 'venue-1',
}

describe('buildWizardResult', () => {
  it('flat: pricing pareja, revenue share directo', () => {
    const r = buildWizardResult({
      ...base,
      model: 'flat',
      flatRate: 0.035,
      flatIncludesTax: true,
      hasPartner: false,
    })
    expect(r.venuePricingInput.rates).toEqual({
      DEBIT: 0.035, CREDIT: 0.035, AMEX: 0.035, INTERNATIONAL: 0.035,
    })
    expect(r.venuePricingInput.includesTax).toBe(true)
    expect(r.revenueShareInput.aggregatorPrice).toBeNull()
    expect(r.revenueShareInput.avoqadoShareOfProviderMargin).toBe(1)
    expect(r.costInput.rates).toEqual(base.cost)
    expect(r.costInput.includesTax).toBe(false)
  })

  it('cost-plus total 3.5% split 50/50: pricing = costo efectivo + 3.5%', () => {
    const r = buildWizardResult({
      ...base,
      model: 'cost-plus',
      markup: 0.035,
      markupIncludesTax: true,
      markupIsNet: false,
      hasPartner: true,
      avoqadoShare: 0.5,
    })
    // débito: 0.0168*1.16 + 0.035 = 0.054488
    expect(r.venuePricingInput.rates.DEBIT).toBeCloseTo(0.054488, 6)
    expect(r.venuePricingInput.rates.AMEX).toBeCloseTo(0.0698, 6)
    expect(r.venuePricingInput.includesTax).toBe(true)
    expect(r.revenueShareInput.avoqadoShareOfProviderMargin).toBe(0.5)
  })

  it('cost-plus limpio (isNet) split 50/50: markup total = 7%', () => {
    const r = buildWizardResult({
      ...base,
      model: 'cost-plus',
      markup: 0.035,
      markupIncludesTax: true,
      markupIsNet: true,
      hasPartner: true,
      avoqadoShare: 0.5,
    })
    // débito: 0.0168*1.16 + 0.07 = 0.089488
    expect(r.venuePricingInput.rates.DEBIT).toBeCloseTo(0.089488, 6)
  })

  it('agregador: revenue share con precio agregador + dos shares', () => {
    const r = buildWizardResult({
      ...base,
      model: 'aggregator',
      aggregatorPrice: { DEBIT: 0.025, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.035 },
      aggIncludesTax: true,
      aggShareProvider: 0.5,
      aggVenuePricing: { DEBIT: 0.035, CREDIT: 0.035, AMEX: 0.035, INTERNATIONAL: 0.035 },
      aggVenueIncludesTax: true,
      aggShareAggregator: 1,
    })
    expect(r.revenueShareInput.aggregatorPrice).toEqual({
      DEBIT: 0.025, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.035,
    })
    expect(r.revenueShareInput.avoqadoShareOfProviderMargin).toBe(0.5)
    expect(r.revenueShareInput.avoqadoShareOfAggregatorMargin).toBe(1)
    expect(r.venuePricingInput.rates.DEBIT).toBe(0.035)
  })
})

describe('wizardEconomics', () => {
  it('cost-plus total: neto Avoqado parejo = markup × share', () => {
    const eco = wizardEconomics({
      ...base,
      model: 'cost-plus',
      markup: 0.035,
      markupIncludesTax: true,
      markupIsNet: false,
      hasPartner: true,
      avoqadoShare: 0.5,
    })
    // pool = 3.5%, neto = 1.75% de $100 = $1.75 en toda tarjeta
    expect(eco.byCard.DEBIT.avoqadoMargin).toBeCloseTo(1.75, 2)
    expect(eco.byCard.AMEX.avoqadoMargin).toBeCloseTo(1.75, 2)
  })

  it('flat: internacional sale negativo con ese costo', () => {
    const eco = wizardEconomics({
      ...base,
      model: 'flat',
      flatRate: 0.035,
      flatIncludesTax: true,
      hasPartner: false,
    })
    // intl efectivo 3.83% > 3.5% → margen negativo
    expect(eco.byCard.INTERNATIONAL.avoqadoMargin! < 0).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run src/features/merchants/pricing-wizard.test.ts`
Expected: FAIL — "Cannot find module './pricing-wizard'".

- [ ] **Step 3: Write the implementation**

Create `src/features/merchants/pricing-wizard.ts`:

```ts
/**
 * Lógica pura del Asistente de pricing. Traduce las respuestas del wizard (en
 * español plano) a los 3 payloads crudos que ya consumen las mutations
 * existentes, y arma el `MerchantEconomics` para el preview. Sin React, sin IO
 * — 100% testeable.
 */
import { CARD_TYPES, type CardRates, type CardType } from './types'
import type { SaveCostInput, SaveRevenueShareInput, SaveVenuePricingInput } from './api'
import { computeMerchantEconomics, type MerchantEconomics } from './economics'

export type ChargeModel = 'flat' | 'cost-plus' | 'aggregator'

const ZERO_RATES: CardRates = { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 }

export interface WizardState {
  // Paso 1 — costo del proveedor
  cost: CardRates
  costIncludesTax: boolean
  taxRate: number
  // Paso 2 — modelo de cobro
  model: ChargeModel
  // flat
  flatRate: number
  flatIncludesTax: boolean
  // cost-plus
  markup: number
  markupIncludesTax: boolean
  markupIsNet: boolean // sólo relevante con socio: ¿el markup es neto (limpio) o total?
  // split (flat + cost-plus)
  hasPartner: boolean
  avoqadoShare: number // 0..1 ; se ignora si !hasPartner (usa 1)
  // aggregator
  aggregatorPrice: CardRates
  aggIncludesTax: boolean
  aggShareProvider: number // 0..1
  aggVenuePricing: CardRates
  aggVenueIncludesTax: boolean
  aggShareAggregator: number // 0..1
  // destino del pricing
  venueId: string
}

export const EMPTY_WIZARD_STATE: WizardState = {
  cost: { ...ZERO_RATES },
  costIncludesTax: true,
  taxRate: 0.16,
  model: 'flat',
  flatRate: 0,
  flatIncludesTax: true,
  markup: 0,
  markupIncludesTax: true,
  markupIsNet: false,
  hasPartner: false,
  avoqadoShare: 1,
  aggregatorPrice: { ...ZERO_RATES },
  aggIncludesTax: true,
  aggShareProvider: 0.5,
  aggVenuePricing: { ...ZERO_RATES },
  aggVenueIncludesTax: true,
  aggShareAggregator: 1,
  venueId: '',
}

export interface WizardResult {
  costInput: SaveCostInput
  revenueShareInput: SaveRevenueShareInput
  venuePricingInput: SaveVenuePricingInput
}

const eff = (rate: number, includesTax: boolean, taxRate: number): number =>
  includesTax ? rate : rate * (1 + taxRate)

const mapRates = (fn: (card: CardType) => number): CardRates =>
  CARD_TYPES.reduce((acc, c) => ({ ...acc, [c]: fn(c) }), {} as CardRates)

/** Share efectivo de Avoqado (1 = te quedas todo si no hay socio). */
function effectiveShare(s: WizardState): number {
  return s.hasPartner ? s.avoqadoShare : 1
}

/** Pricing efectivo (con IVA) que paga el venue, por tarjeta, según el modelo. */
function venuePriceEff(s: WizardState): CardRates {
  const costEff = mapRates((c) => eff(s.cost[c], s.costIncludesTax, s.taxRate))
  if (s.model === 'flat') {
    return mapRates(() => eff(s.flatRate, s.flatIncludesTax, s.taxRate))
  }
  if (s.model === 'aggregator') {
    return mapRates((c) => eff(s.aggVenuePricing[c], s.aggVenueIncludesTax, s.taxRate))
  }
  // cost-plus
  const markupEff = eff(s.markup, s.markupIncludesTax, s.taxRate)
  const share = effectiveShare(s)
  const markupTotalEff = s.hasPartner && s.markupIsNet ? markupEff / share : markupEff
  return mapRates((c) => costEff[c] + markupTotalEff)
}

export function buildWizardResult(s: WizardState): WizardResult {
  const costInput: SaveCostInput = {
    rates: s.cost,
    includesTax: s.costIncludesTax,
    taxRate: s.taxRate,
  }

  if (s.model === 'aggregator') {
    return {
      costInput,
      revenueShareInput: {
        aggregatorPrice: s.aggregatorPrice,
        aggregatorPriceIncludesTax: s.aggIncludesTax,
        avoqadoShareOfProviderMargin: s.aggShareProvider,
        avoqadoShareOfAggregatorMargin: s.aggShareAggregator,
        taxRate: s.taxRate,
      },
      venuePricingInput: {
        rates: s.aggVenuePricing,
        includesTax: s.aggVenueIncludesTax,
        taxRate: s.taxRate,
      },
    }
  }

  // flat + cost-plus → revenue share directo
  const revenueShareInput: SaveRevenueShareInput = {
    aggregatorPrice: null,
    aggregatorPriceIncludesTax: false,
    avoqadoShareOfProviderMargin: effectiveShare(s),
    avoqadoShareOfAggregatorMargin: null,
    taxRate: s.taxRate,
  }

  if (s.model === 'flat') {
    return {
      costInput,
      revenueShareInput,
      venuePricingInput: {
        rates: mapRates(() => s.flatRate),
        includesTax: s.flatIncludesTax,
        taxRate: s.taxRate,
      },
    }
  }

  // cost-plus: el pricing se guarda como CRUDO efectivo (ya con IVA) → includesTax true
  return {
    costInput,
    revenueShareInput,
    venuePricingInput: {
      rates: venuePriceEff(s),
      includesTax: true,
      taxRate: s.taxRate,
    },
  }
}

/** Economía para el preview del Paso 3 (neto real con split aplicado). */
export function wizardEconomics(s: WizardState): MerchantEconomics {
  const costEff = mapRates((c) => eff(s.cost[c], s.costIncludesTax, s.taxRate))
  if (s.model === 'aggregator') {
    return computeMerchantEconomics({
      cost: costEff,
      venuePrice: mapRates((c) => eff(s.aggVenuePricing[c], s.aggVenueIncludesTax, s.taxRate)),
      revenueShare: {
        aggregatorPrice: mapRates((c) => eff(s.aggregatorPrice[c], s.aggIncludesTax, s.taxRate)),
        avoqadoShareOfProviderMargin: s.aggShareProvider,
        avoqadoShareOfAggregatorMargin: s.aggShareAggregator,
        taxRate: s.taxRate,
      },
    })
  }
  return computeMerchantEconomics({
    cost: costEff,
    venuePrice: venuePriceEff(s),
    revenueShare: {
      aggregatorPrice: null,
      avoqadoShareOfProviderMargin: effectiveShare(s),
      avoqadoShareOfAggregatorMargin: null,
      taxRate: s.taxRate,
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run src/features/merchants/pricing-wizard.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/features/merchants/pricing-wizard.ts src/features/merchants/pricing-wizard.test.ts
git commit -m "feat(merchants): pricing wizard translation logic"
```

---

## Task 2: Prop `initialValues` en los drawers de economía y pricing

**Files:**
- Modify: `src/features/merchants/EditEconomicsDrawer.tsx`
- Modify: `src/features/merchants/EditVenuePricingDrawer.tsx`

**Interfaces:**
- Produces:
  - `EditEconomicsDrawer` gana prop `initialValues?: { rates: CardRates; includesTax: boolean; revenueShare: RevenueShareDraft }`
  - `EditVenuePricingDrawer` gana prop `initialValues?: { rates: CardRates; includesTax: boolean }`
- Consumes: `RevenueShareDraft` de `./revenue-share`, `CardRates` de `./types`.

**Contexto:** ambos drawers se desmontan al cerrar (`CardRatesInput` se remonta fresco al abrir), así que un `useState` inicializado desde `initialValues` se aplica cada vez que se abre. `EditVenuePricingDrawer` conserva su fetch para obtener `activeId` (PUT vs POST), pero salta la hidratación de rates si hay `initialValues`.

- [ ] **Step 1: Añadir el prop a `EditEconomicsDrawer`**

En `src/features/merchants/EditEconomicsDrawer.tsx`, importar el tipo y extender `Props`:

```ts
import type { RevenueShareDraft } from './revenue-share'
```

Añadir a la interface `Props` (después de `onSaved?`):

```ts
  /** Valores del Asistente de pricing para prellenar (override del estado guardado). */
  initialValues?: {
    rates: CardRates
    includesTax: boolean
    revenueShare: RevenueShareDraft
  }
```

Añadir `initialValues` al destructuring de props y cambiar los 3 `useState` iniciales:

```ts
  const [rates, setRates] = useState<CardRates>(
    initialValues?.rates ?? (cost ? rawCardRates(cost) : ZERO),
  )
  const [includesTax, setIncludesTax] = useState<boolean>(
    initialValues?.includesTax ?? cost?.includesTax ?? true,
  )
  const [rs, setRs] = useState(() => initialValues?.revenueShare ?? initRevenueShareDraft(revenueShare))
```

- [ ] **Step 2: Añadir el prop a `EditVenuePricingDrawer`**

En `src/features/merchants/EditVenuePricingDrawer.tsx`, añadir a `Props`:

```ts
  /** Valores del Asistente de pricing para prellenar (override del fetch). */
  initialValues?: { rates: CardRates; includesTax: boolean }
```

Añadir `initialValues` al destructuring y cambiar el bloque de hidratación:

```ts
  // Hidrata el form una vez que carga el pricing (computado en render, sin useEffect).
  // Si el Asistente pasó initialValues, esos ganan sobre lo guardado.
  if (open && !hydrated && (initialValues || pricingQ.isSuccess)) {
    setHydrated(true)
    if (initialValues) {
      setRates(initialValues.rates)
      setIncludesTax(initialValues.includesTax)
    } else if (loaded) {
      setRates(rawCardRates(loaded))
      setIncludesTax(loaded.includesTax ?? true)
    }
  }
```

- [ ] **Step 3: Typecheck**

Run: `PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificar que los tests existentes de ambos drawers siguen verdes**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run src/features/merchants/EditEconomicsDrawer.test.tsx src/features/merchants/EditVenuePricingDrawer.test.tsx`
Expected: PASS (los props nuevos son opcionales; los usos existentes no cambian).

- [ ] **Step 5: Commit**

```bash
git add src/features/merchants/EditEconomicsDrawer.tsx src/features/merchants/EditVenuePricingDrawer.tsx
git commit -m "feat(merchants): optional initialValues on economics/pricing drawers"
```

---

## Task 3: Drawer del asistente (`PricingWizardDrawer.tsx`)

**Files:**
- Create: `src/features/merchants/PricingWizardDrawer.tsx`
- Test: `src/features/merchants/PricingWizardDrawer.test.tsx`

**Interfaces:**
- Consumes: `WizardState`, `EMPTY_WIZARD_STATE`, `buildWizardResult`, `wizardEconomics`, `ChargeModel` de `./pricing-wizard`; `CardRatesInput`, `Combobox`, `Drawer*`, `Button`, `Badge`; `computeMerchantEconomics` vía `wizardEconomics`; `humanizeCardType`, `CARD_TYPES`, `AccountSlot`, `ProviderCostStructure` de `./types`.
- Produces:
  - `interface PricingWizardResult { result: WizardResult; venueId: string; venueName: string; slot: AccountSlot }`
  - `PricingWizardDrawer` component. Props: `{ open; onOpenChange; cost: ProviderCostStructure | null; venues: { venueId; venueName; slot: AccountSlot }[]; onPrefill: (r: PricingWizardResult) => void }`
  - Al presionar "Prellenar y revisar" llama `onPrefill(...)` y cierra.

- [ ] **Step 1: Write the failing component test**

Create `src/features/merchants/PricingWizardDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PricingWizardDrawer } from './PricingWizardDrawer'

const venues = [{ venueId: 'v1', venueName: 'Berthe', slot: 'SECONDARY' as const }]

describe('PricingWizardDrawer', () => {
  it('recorre flat y emite onPrefill con el pricing pareja', () => {
    const onPrefill = vi.fn()
    render(
      <PricingWizardDrawer
        open
        onOpenChange={() => {}}
        cost={null}
        venues={venues}
        onPrefill={onPrefill}
      />,
    )
    // Paso 1: costo débito 1.68
    fireEvent.change(screen.getByLabelText(/Débito/i), { target: { value: '1.68' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    // Paso 2: flat 3.5
    fireEvent.click(screen.getByRole('button', { name: /Tasa pareja/i }))
    fireEvent.change(screen.getByLabelText(/% que paga el venue/i), { target: { value: '3.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    // Paso 3: elegir venue + prellenar
    fireEvent.click(screen.getByRole('button', { name: /Prellenar y revisar/i }))
    expect(onPrefill).toHaveBeenCalledTimes(1)
    const arg = onPrefill.mock.calls[0][0]
    expect(arg.venueId).toBe('v1')
    expect(arg.result.venuePricingInput.rates.DEBIT).toBe(0.035)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run src/features/merchants/PricingWizardDrawer.test.tsx`
Expected: FAIL — "Cannot find module './PricingWizardDrawer'".

- [ ] **Step 3: Write the component**

Create `src/features/merchants/PricingWizardDrawer.tsx`. Estructura: 3 pasos con `step` local, cada paso reutiliza los primitives. Los `<Combobox>` reemplazan cualquier `<select>`. El look fino se pule con `impeccable` después; este código es funcional y sigue los patrones del repo.

```tsx
import { useMemo, useState } from 'react'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerSubtitle, DrawerBody, DrawerFooter,
} from '@/shared/ui/Drawer'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { Combobox } from '@/shared/ui/Combobox'
import { CardRatesInput } from './CardRatesInput'
import {
  EMPTY_WIZARD_STATE, buildWizardResult, wizardEconomics,
  type WizardState, type ChargeModel, type WizardResult,
} from './pricing-wizard'
import { CARD_TYPES, humanizeCardType, rawCardRates, type AccountSlot, type ProviderCostStructure } from './types'
import { initRevenueShareDraft } from './revenue-share'

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

const pct = (d: number) => String(Math.round(d * 10000) / 100)
const toDec = (raw: string) => (raw.trim() === '' ? 0 : (parseFloat(raw) || 0) / 100)
const money = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

const pctInput =
  'h-9 w-28 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'

export function PricingWizardDrawer({ open, onOpenChange, cost, venues, onPrefill }: Props) {
  const [step, setStep] = useState(1)
  const [s, setS] = useState<WizardState>(() => ({
    ...EMPTY_WIZARD_STATE,
    cost: cost ? rawCardRates(cost) : EMPTY_WIZARD_STATE.cost,
    costIncludesTax: cost?.includesTax ?? true,
    taxRate: cost?.taxRate ?? 0.16,
    venueId: venues[0]?.venueId ?? '',
  }))
  const patch = (p: Partial<WizardState>) => setS((prev) => ({ ...prev, ...p }))

  const economics = useMemo(() => wizardEconomics(s), [s])
  const hasNegative = CARD_TYPES.some((c) => (economics.byCard[c].avoqadoMargin ?? 0) < 0)
  const venue = venues.find((v) => v.venueId === s.venueId) ?? null

  function reset() {
    setStep(1)
    setS({
      ...EMPTY_WIZARD_STATE,
      cost: cost ? rawCardRates(cost) : EMPTY_WIZARD_STATE.cost,
      costIncludesTax: cost?.includesTax ?? true,
      taxRate: cost?.taxRate ?? 0.16,
      venueId: venues[0]?.venueId ?? '',
    })
  }

  function handlePrefill() {
    if (!venue) return
    onPrefill({ result: buildWizardResult(s), venueId: venue.venueId, venueName: venue.venueName, slot: venue.slot })
    onOpenChange(false)
    reset()
  }

  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>Asistente de pricing</DrawerTitle>
          <DrawerSubtitle>Paso {step} de 3</DrawerSubtitle>
        </DrawerHeader>
        <DrawerBody>
          {step === 1 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-[13px] font-semibold text-[var(--ink)]">¿Cuánto te cobra tu procesador?</h3>
              <CardRatesInput value={s.cost} onChange={(cost) => patch({ cost })} idPrefix="wiz-cost" />
              <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                <input type="checkbox" checked={s.costIncludesTax}
                  onChange={(e) => patch({ costIncludesTax: e.target.checked })} />
                Estas tasas ya incluyen IVA
              </label>
            </section>
          )}

          {step === 2 && (
            <section className="flex flex-col gap-4">
              <div>
                <span className={labelCls}>¿Cómo le cobras al venue?</span>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['flat', 'Tasa pareja'],
                    ['cost-plus', 'Costo + comisión'],
                    ['aggregator', 'Vía agregador'],
                  ] as [ChargeModel, string][]).map(([m, label]) => (
                    <Button key={m} type="button" size="sm"
                      variant={s.model === m ? 'primary' : 'secondary'}
                      onClick={() => patch({ model: m })}>
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {s.model === 'flat' && (
                <div>
                  <label htmlFor="wiz-flat" className={labelCls}>% que paga el venue</label>
                  <input id="wiz-flat" className={pctInput} inputMode="decimal"
                    value={pct(s.flatRate)} onChange={(e) => patch({ flatRate: toDec(e.target.value) })} />
                  <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                    <input type="checkbox" checked={s.flatIncludesTax}
                      onChange={(e) => patch({ flatIncludesTax: e.target.checked })} />
                    Ya incluye IVA
                  </label>
                </div>
              )}

              {s.model === 'cost-plus' && (
                <div className="flex flex-col gap-3">
                  <div>
                    <label htmlFor="wiz-markup" className={labelCls}>Tu comisión (%)</label>
                    <input id="wiz-markup" className={pctInput} inputMode="decimal"
                      value={pct(s.markup)} onChange={(e) => patch({ markup: toDec(e.target.value) })} />
                    <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                      <input type="checkbox" checked={s.markupIncludesTax}
                        onChange={(e) => patch({ markupIncludesTax: e.target.checked })} />
                      Esa comisión lleva IVA
                    </label>
                  </div>
                </div>
              )}

              {s.model === 'aggregator' && (
                <div className="flex flex-col gap-3">
                  <div>
                    <span className={labelCls}>¿Cuánto le cobras al agregador?</span>
                    <CardRatesInput value={s.aggregatorPrice}
                      onChange={(aggregatorPrice) => patch({ aggregatorPrice })} idPrefix="wiz-agg" />
                    <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                      <input type="checkbox" checked={s.aggIncludesTax}
                        onChange={(e) => patch({ aggIncludesTax: e.target.checked })} />
                      Ya incluye IVA
                    </label>
                  </div>
                  <div>
                    <label htmlFor="wiz-agg-sp" className={labelCls}>Tu % del margen proveedor→agregador</label>
                    <input id="wiz-agg-sp" className={pctInput} inputMode="decimal"
                      value={pct(s.aggShareProvider)} onChange={(e) => patch({ aggShareProvider: toDec(e.target.value) })} />
                  </div>
                  <div>
                    <span className={labelCls}>¿Cuánto le cobra el agregador al venue?</span>
                    <CardRatesInput value={s.aggVenuePricing}
                      onChange={(aggVenuePricing) => patch({ aggVenuePricing })} idPrefix="wiz-agg-venue" />
                    <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                      <input type="checkbox" checked={s.aggVenueIncludesTax}
                        onChange={(e) => patch({ aggVenueIncludesTax: e.target.checked })} />
                      Ya incluye IVA
                    </label>
                  </div>
                  <div>
                    <label htmlFor="wiz-agg-sa" className={labelCls}>Tu % del margen agregador→venue</label>
                    <input id="wiz-agg-sa" className={pctInput} inputMode="decimal"
                      value={pct(s.aggShareAggregator)} onChange={(e) => patch({ aggShareAggregator: toDec(e.target.value) })} />
                  </div>
                </div>
              )}

              {(s.model === 'flat' || s.model === 'cost-plus') && (
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                    <input type="checkbox" checked={s.hasPartner}
                      onChange={(e) => patch({ hasPartner: e.target.checked, avoqadoShare: e.target.checked ? 0.5 : 1 })} />
                    Reparto mi ganancia con un socio
                  </label>
                  {s.hasPartner && (
                    <div>
                      <label htmlFor="wiz-share" className={labelCls}>% que es tuyo</label>
                      <input id="wiz-share" className={pctInput} inputMode="decimal"
                        value={pct(s.avoqadoShare)} onChange={(e) => patch({ avoqadoShare: toDec(e.target.value) })} />
                    </div>
                  )}
                  {s.model === 'cost-plus' && s.hasPartner && (
                    <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                      <input type="checkbox" checked={s.markupIsNet}
                        onChange={(e) => patch({ markupIsNet: e.target.checked })} />
                      Esa comisión es lo que quiero ganar limpio (no la que reparto)
                    </label>
                  )}
                </div>
              )}
            </section>
          )}

          {step === 3 && (
            <section className="flex flex-col gap-4">
              <div className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas-sunken)] p-3">
                <p className="mb-2 text-[12px] font-medium text-[var(--ink)]">Tu margen neto (por $100)</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {CARD_TYPES.map((c) => {
                    const m = economics.byCard[c].avoqadoMargin
                    return (
                      <div key={c} className="flex items-baseline justify-between">
                        <dt className="text-[12px] text-[var(--ink-muted)]">{humanizeCardType(c)}</dt>
                        <dd className={`text-[13px] font-semibold tabular-nums ${(m ?? 0) < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                          {money(m)}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              </div>
              {hasNegative && (
                <p className="text-[12px] text-[var(--warn)]" role="alert">
                  Ojo: alguna tarjeta sale con margen negativo — pierdes en esa tarjeta.
                </p>
              )}
              <div>
                <span className={labelCls}>¿A qué venue le aplico este pricing?</span>
                <Combobox
                  value={s.venueId}
                  onChange={(v) => patch({ venueId: v })}
                  options={venues.map((v) => ({ value: v.venueId, label: `${v.venueName} · ${v.slot}` }))}
                  placeholder="Elegir venue"
                  ariaLabel="Venue destino"
                />
              </div>
            </section>
          )}
        </DrawerBody>
        <DrawerFooter>
          {step > 1 && (
            <Button type="button" variant="ghost" onClick={() => setStep((n) => n - 1)}>Atrás</Button>
          )}
          {step < 3 ? (
            <Button type="button" onClick={() => setStep((n) => n + 1)}>Siguiente</Button>
          ) : (
            <Button type="button" disabled={!venue} onClick={handlePrefill}>Prellenar y revisar</Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
```

> Nota de diseño: al integrar, correr `impeccable:frontend-design` para el layout del stepper (indicador de pasos, jerarquía) y `impeccable:audit` antes de push. El markup de arriba es funcional y usa los primitives correctos; no dejar los checkboxes nativos si el repo tiene un primitive de checkbox — de momento no existe, así que quedan nativos con label.

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run src/features/merchants/PricingWizardDrawer.test.tsx`
Expected: PASS. Si el label del input flat no matchea, ajustar el selector del test al `htmlFor`/texto real (mantener el assert de `onPrefill`).

- [ ] **Step 5: Commit**

```bash
git add src/features/merchants/PricingWizardDrawer.tsx src/features/merchants/PricingWizardDrawer.test.tsx
git commit -m "feat(merchants): pricing wizard drawer (3-step stepper)"
```

---

## Task 4: Integrar en `MerchantDetailPage` (botón + prellenado secuencial)

**Files:**
- Modify: `src/features/merchants/MerchantDetailPage.tsx`

**Interfaces:**
- Consumes: `PricingWizardDrawer`, `PricingWizardResult` de `./PricingWizardDrawer`; `revenueShareToDraft` helper (ver Step 1) o `initRevenueShareDraft`.

**Flujo:** el wizard emite `onPrefill(r)`. Guardamos `r` y abrimos `EditEconomicsDrawer` con `initialValues` (costo + reparto). Cuando el operador guarda (`onSaved`), abrimos `EditVenuePricingDrawer` con `initialValues` (pricing). Al guardar ese, limpiamos.

- [ ] **Step 1: Añadir un helper para derivar el `RevenueShareDraft` desde el `SaveRevenueShareInput`**

En `src/features/merchants/revenue-share.ts`, añadir (para que el prefill de economía traiga el reparto ya elegido):

```ts
import type { SaveRevenueShareInput } from './api'

/** Draft desde el body que produce el Asistente (para prellenar el editor). */
export function draftFromInput(input: SaveRevenueShareInput): RevenueShareDraft {
  return {
    mode: input.aggregatorPrice ? 'aggregator' : 'direct',
    aggregatorPrice: input.aggregatorPrice ?? { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 },
    aggIncludesTax: input.aggregatorPriceIncludesTax,
    shareProvider: input.avoqadoShareOfProviderMargin,
    shareAgg: input.avoqadoShareOfAggregatorMargin ?? 0.7,
  }
}
```

- [ ] **Step 2: Wire en `MerchantDetailPage`**

Añadir imports:

```ts
import { PricingWizardDrawer, type PricingWizardResult } from './PricingWizardDrawer'
import { draftFromInput } from './revenue-share'
```

Añadir estado (junto a los otros `useState`):

```ts
  const [wizardOpen, setWizardOpen] = useState(false)
  const [prefill, setPrefill] = useState<PricingWizardResult | null>(null)
  const [prefillStage, setPrefillStage] = useState<'eco' | 'pricing' | null>(null)
```

Añadir el botón en el header de la sección Economía (junto al "Editar" de `setEditingEco`):

```tsx
            <Button size="sm" variant="ghost" onClick={() => setWizardOpen(true)}>
              Asistente
            </Button>
```

Añadir el wizard + la orquestación cerca de los otros drawers (antes del `</Shell>`):

```tsx
      <PricingWizardDrawer
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        cost={eco.cost}
        venues={eco.venueConfigs.map((c) => ({
          venueId: c.venueId, venueName: c.venue.name, slot: c.slot,
        }))}
        onPrefill={(r) => { setPrefill(r); setPrefillStage('eco') }}
      />
```

Modificar el `EditEconomicsDrawer` existente para aceptar el prefill: cambiar su `open` y añadir `initialValues` cuando estamos en la etapa `eco`:

```tsx
      <EditEconomicsDrawer
        open={editingEco || prefillStage === 'eco'}
        onOpenChange={(o) => {
          if (prefillStage === 'eco') { if (!o) { setEditingEco(false) } }
          else setEditingEco(o)
        }}
        merchantId={m.id}
        cost={eco.cost}
        revenueShare={eco.revenueShare}
        initialValues={
          prefillStage === 'eco' && prefill
            ? {
                rates: prefill.result.costInput.rates,
                includesTax: prefill.result.costInput.includesTax,
                revenueShare: draftFromInput(prefill.result.revenueShareInput),
              }
            : undefined
        }
        onSaved={() => {
          eco.refetch()
          if (prefillStage === 'eco') setPrefillStage('pricing')
        }}
      />
```

Modificar el bloque `pricingTarget` para que también dispare con el prefill de pricing. Reemplazar el bloque `{pricingTarget && (…)}` por:

```tsx
      {(pricingTarget || (prefillStage === 'pricing' && prefill)) && (
        <EditVenuePricingDrawer
          open={!!pricingTarget || prefillStage === 'pricing'}
          onOpenChange={(o) => {
            if (!o) {
              setPricingTarget(null)
              if (prefillStage === 'pricing') { setPrefillStage(null); setPrefill(null) }
            }
          }}
          venueId={pricingTarget?.venueId ?? prefill!.venueId}
          venueName={pricingTarget?.venueName ?? prefill!.venueName}
          slot={pricingTarget?.slot ?? prefill!.slot}
          cost={eco.cost}
          initialValues={
            prefillStage === 'pricing' && prefill
              ? { rates: prefill.result.venuePricingInput.rates, includesTax: prefill.result.venuePricingInput.includesTax }
              : undefined
          }
          onSaved={() => {
            eco.refetch()
            if (prefillStage === 'pricing') { setPrefillStage(null); setPrefill(null) }
          }}
        />
      )}
```

- [ ] **Step 3: Typecheck + lint**

Run: `PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit && PATH="/opt/homebrew/bin:$PATH" npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificar tests de la página**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run src/features/merchants/MerchantDetailPage.test.tsx`
Expected: PASS (el botón "Asistente" es aditivo; si el test cuenta botones exactos, ajustar).

- [ ] **Step 5: Commit**

```bash
git add src/features/merchants/MerchantDetailPage.tsx src/features/merchants/revenue-share.ts
git commit -m "feat(merchants): wire pricing wizard into merchant detail"
```

---

## Task 5: Docs + verificación final

**Files:**
- Modify: `CHANGELOG.md`, `README.md`

- [ ] **Step 1: CHANGELOG**

En `CHANGELOG.md`, bajo `## [Unreleased]` → `### Added`:

```markdown
- **Asistente de pricing** en el detalle del merchant: wizard de 3 pasos (flat / cost-plus / agregador) que calcula el pricing por tarjeta y prellena los drawers de economía y pricing del venue para confirmar.
```

- [ ] **Step 2: README**

En `README.md`, donde se listan las páginas/acciones del detalle de merchant, añadir una línea mencionando el "Asistente de pricing" (calculadora que prellena costo + reparto + pricing del venue). Mantener el estilo del listado existente.

- [ ] **Step 3: Verificación completa**

Run: `PATH="/opt/homebrew/bin:$PATH" npm run check`
Expected: lint + typecheck + tests en verde.

Run: `PATH="/opt/homebrew/bin:$PATH" npm run build`
Expected: build de producción sin errores.

- [ ] **Step 4: Verificación en navegador (preview)**

Levantar el dev server (preview_start con el nombre del server del repo), navegar al detalle de un merchant, abrir "Asistente", recorrer los 3 pasos con el caso Berthe (costo 1.68/2.05/3/3.3, cost-plus 3.5 % 50/50), confirmar que:
- El Paso 3 muestra neto ≈ $1.75 parejo.
- "Prellenar y revisar" abre el drawer de economía con costo + reparto puestos, y al guardar abre el de pricing con 5.45/5.88/6.98/7.33.
Tomar screenshot como prueba.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "docs(merchants): document pricing wizard"
```

---

## Self-Review (hecho al escribir el plan)

- **Spec coverage:** los 3 modos (Task 1 + 3), prellenado punta a punta (Task 2 + 4), stepper (Task 3), casos ancla (tests Task 1), docs (Task 5). ✅
- **Types:** `WizardState`, `WizardResult`, `PricingWizardResult` consistentes entre tasks; `buildWizardResult`/`wizardEconomics` con la misma firma en test y componente. ✅
- **Placeholders:** ninguno — código completo en cada step. ✅
- **Riesgo conocido:** los selectores de los tests de componente/página dependen de labels exactos; el plan indica ajustarlos manteniendo los asserts de comportamiento (`onPrefill`, pricing). El prellenado secuencial de drawers asume que se desmontan al cerrar (confirmado por el comentario de `CardRatesInput`).
