# Merchant Accounts — F1 Parte A: Fundación + Registro (lectura) · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la consola `/merchants` (lista + detalle de **sólo lectura** que hace legible la economía proveedor→agregador→Avoqado→venue), sobre endpoints existentes de `avoqado-server` + un cambio aditivo de routing.

**Architecture:** Feature nuevo `src/features/merchants/` (api → hooks TanStack Query → páginas). La matemática del dinero y el readiness viven en módulos puros y testeados (`economics.ts`, `readiness.ts`). Sin escrituras todavía (CRUD = Parte B). Realtime por invalidación de queries.

**Tech Stack:** React 18 + Vite + TS strict · TanStack Query · React Router (lazy) · Tailwind v4 + design system propio (`DataTable`, `Badge`, `IconButton`, `QueryError`) · Vitest + RTL + MSW.

**Spec:** `docs/superpowers/specs/2026-05-24-merchant-accounts-f1-design.md`

**Restricciones de sesión:** trabajar en la branch **`develop`** (sin worktree ni branch nuevo). Los pasos "Commit" asumen que el usuario pidió commitear; si no, sólo deja el árbol limpio y verde. Nunca `--no-verify`.

---

## Mapa de archivos

| Archivo                                              | Responsabilidad                                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `avoqado-server/src/routes/superadmin.routes.ts`     | **Modificar**: montar `merchant-revenue-shares` + `settlement-configurations` bajo `/api/v1/superadmin/*` (aditivo). |
| `src/features/merchants/types.ts`                    | Tipos del dominio + enums + `CardRates` + `effectiveRate()` + tone maps/humanizers.                                  |
| `src/features/merchants/economics.ts`                | Cálculo puro de la cadena de dinero (4 modos) por tipo de tarjeta.                                                   |
| `src/features/merchants/economics.test.ts`           | Tests del cálculo (con los números de la doc Moneygiver).                                                            |
| `src/features/merchants/readiness.ts`                | Reglas de completitud (chips).                                                                                       |
| `src/features/merchants/readiness.test.ts`           | Tests de readiness.                                                                                                  |
| `src/features/merchants/api.ts`                      | Wrappers `/superadmin/*` + mapeo raw→dominio.                                                                        |
| `src/features/merchants/use-merchants.ts`            | Hooks: `useMerchants`, `useMerchant`, `useProviders`, `useMerchantEconomicsData`.                                    |
| `src/features/merchants/ReadinessStrip.tsx`          | Tira de readiness (reusa tono SetupIcons).                                                                           |
| `src/features/merchants/MoneyFlow.tsx`               | Flujo escalonado (Overview).                                                                                         |
| `src/features/merchants/EconomicsTable.tsx`          | Tabla "estado de resultados" por tarjeta.                                                                            |
| `src/features/merchants/MerchantsPage.tsx`           | Lista `/merchants` (DataTable).                                                                                      |
| `src/features/merchants/MerchantDetailPage.tsx`      | Detalle `/merchants/:id` (seccionado, readiness-first).                                                              |
| `src/app/router.tsx`                                 | **Modificar**: rutas `/merchants`, `/merchants/:id` (lazy).                                                          |
| `src/shared/layouts/AppLayout.tsx`                   | **Modificar**: quitar `disabled` del nav `/merchants`.                                                               |
| `src/features/realtime/use-realtime-invalidation.ts` | **Modificar**: evento `superadmin:merchant:updated`.                                                                 |
| `src/test/mocks/handlers.ts`                         | **Modificar**: handlers MSW de los endpoints de merchants.                                                           |
| `CHANGELOG.md`, `README.md`                          | **Modificar**: entrada + página nueva.                                                                               |

Convención de query keys: **`['superadmin','merchants', …]`** (NO `['superadmin','merchant-accounts']`, que ya lo usa el selector de `terminals/use-terminals.ts`).

---

## Task 0: Backend — exponer revenue-shares + settlement bajo `/superadmin/*` (aditivo)

**Files:**

- Modify: `avoqado-server/src/routes/superadmin.routes.ts`

- [ ] **Step 1: Agregar los 2 imports**

En la zona de imports de sub-rutas (junto a los demás `import … from './superadmin/…'`), añade:

```ts
import settlementConfigRoutes from './superadmin/settlementConfiguration.routes'
import merchantRevenueShareRoutes from './superadmin/merchantRevenueShare.routes'
```

- [ ] **Step 2: Montar las 2 rutas**

Después de `router.use('/venue-commissions', venueCommissionRoutes)` agrega:

```ts
// Aditivo (2026-05): mismos controllers que ya viven en /api/v1/dashboard/superadmin/*,
// expuestos también aquí para que el frontend superadmin use un solo namespace.
router.use('/settlement-configurations', settlementConfigRoutes)
router.use('/merchant-revenue-shares', merchantRevenueShareRoutes)
```

- [ ] **Step 3: Verificar que el server compila y las rutas responden**

Run: `cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit`
Expected: sin errores nuevos.

Run (con el server local arriba y sesión superadmin): `curl -s -i localhost:3000/api/v1/superadmin/settlement-configurations | head -1`
Expected: `HTTP/1.1 401` (no `404`) — la ruta existe (401 porque el curl no manda cookie). Igual para `/merchant-revenue-shares`.

- [ ] **Step 4: Commit (si el usuario lo pidió)**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
git add src/routes/superadmin.routes.ts
git commit -m "feat(superadmin): expose merchant-revenue-shares + settlement-configurations under /superadmin namespace"
```

> ⚠️ Deploy server-first. El frontend depende de estas rutas para el detalle.

---

## Task 1: Tipos del dominio (`types.ts`)

**Files:**

- Create: `src/features/merchants/types.ts`

- [ ] **Step 1: Escribir el archivo completo**

```ts
/**
 * Tipos del feature Merchant Accounts. Mirror del backend
 * (`avoqado-server/prisma/schema.prisma`): MerchantAccount, PaymentProvider,
 * ProviderCostStructure, MerchantRevenueShare, SettlementConfiguration.
 *
 * Las tasas Decimal del backend llegan como `string` o `number` en JSON; aquí
 * las normalizamos a `number` (fracción 0..1, ej. 0.025 = 2.5%).
 */

export type CardType = 'DEBIT' | 'CREDIT' | 'AMEX' | 'INTERNATIONAL'
export const CARD_TYPES: readonly CardType[] = ['DEBIT', 'CREDIT', 'AMEX', 'INTERNATIONAL']

export type CardRates = Record<CardType, number>

export type ProviderType = 'PAYMENT_PROCESSOR' | 'BANK_DIRECT' | 'WALLET' | 'GATEWAY' | 'OTHER'
export type AccountSlot = 'PRIMARY' | 'SECONDARY' | 'TERTIARY'

export interface MerchantProvider {
  id: string
  code: string // "BLUMON", "ANGELPAY", …
  name: string
  type: ProviderType
}

export interface MerchantVenueRef {
  id: string
  name: string
  slug: string
}

/** Shape de cada fila de `GET /superadmin/merchant-accounts` (credenciales NO incluidas). */
export interface MerchantAccount {
  id: string
  provider: MerchantProvider
  externalMerchantId: string
  alias: string | null
  displayName: string | null
  active: boolean
  displayOrder: number
  clabeNumber: string | null
  bankName: string | null
  accountHolder: string | null
  hasCredentials: boolean
  // Blumon
  blumonSerialNumber: string | null
  blumonPosId: string | null
  blumonEnvironment: string | null // "SANDBOX" | "PRODUCTION" | null
  blumonMerchantId: string | null
  // AngelPay
  angelpayAffiliation: string | null
  angelpayMerchantName: string | null
  aggregatorId: string | null
  venues: MerchantVenueRef[]
  terminals: { id: string; serialNumber: string }[]
  counts: { costStructures: number; venueConfigs: number; terminals: number }
  createdAt: string
  updatedAt: string
}

export interface ProviderCostStructure {
  id: string
  merchantAccountId: string
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax: boolean | null
  taxRate: number
  fixedCostPerTransaction: number | null
  effectiveFrom: string
  effectiveTo: string | null
  active: boolean
}

export interface MerchantRevenueShare {
  id: string
  merchantAccountId: string
  aggregatorPrice: CardRates | null // null = venta directa
  aggregatorPriceIncludesTax: boolean
  avoqadoShareOfProviderMargin: number // 0..1
  avoqadoShareOfAggregatorMargin: number | null
  taxRate: number
  active: boolean
}

export type SettlementDayType = 'BUSINESS_DAYS' | 'CALENDAR_DAYS'

export interface SettlementConfiguration {
  id: string
  merchantAccountId: string
  cardType: CardType
  settlementDays: number
  settlementDayType: SettlementDayType
  cutoffTime: string
  cutoffTimezone: string
  effectiveFrom: string
  effectiveTo: string | null
}

/** Config de pago de un venue que referencia a esta cuenta + en qué slot. */
export interface MerchantVenueConfig {
  venueId: string
  venue: MerchantVenueRef
  slot: AccountSlot
}

/* --- Helpers de tasa --- */

/**
 * Tasa efectiva: si `includesTax === false`, la tasa guardada es base y se le
 * suma el impuesto (× (1 + taxRate)). Si es `true` o `null` (legacy), la tasa
 * ya es final. Mismo criterio que ProviderCostStructure/VenuePricingStructure.
 */
export function effectiveRate(rate: number, includesTax: boolean | null, taxRate: number): number {
  if (includesTax === false) return rate * (1 + taxRate)
  return rate
}

export function cardRatesFromCost(cost: ProviderCostStructure): CardRates {
  return {
    DEBIT: effectiveRate(cost.debitRate, cost.includesTax, cost.taxRate),
    CREDIT: effectiveRate(cost.creditRate, cost.includesTax, cost.taxRate),
    AMEX: effectiveRate(cost.amexRate, cost.includesTax, cost.taxRate),
    INTERNATIONAL: effectiveRate(cost.internationalRate, cost.includesTax, cost.taxRate),
  }
}

/* --- Humanizers + tones --- */

type Tone = 'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'

export function humanizeCardType(c: CardType): string {
  switch (c) {
    case 'DEBIT':
      return 'Débito'
    case 'CREDIT':
      return 'Crédito'
    case 'AMEX':
      return 'AMEX'
    case 'INTERNATIONAL':
      return 'Internacional'
  }
}

export function humanizeEnvironment(env: string | null): string {
  if (env === 'PRODUCTION') return 'Producción'
  if (env === 'SANDBOX') return 'Sandbox'
  return '—'
}

/** El ambiente es estado operativo: PROD = ok (success), SANDBOX = atención (warn). */
export function environmentTone(env: string | null): Tone {
  if (env === 'PRODUCTION') return 'success'
  if (env === 'SANDBOX') return 'warn'
  return 'muted'
}

/** Estado activo/inactivo: activo = success, inactivo = muted (sin juicio negativo). */
export function activeTone(active: boolean): Tone {
  return active ? 'success' : 'muted'
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `cd /Users/amieva/Documents/Programming/Avoqado/avoqado-superadmin && npx tsc --noEmit`
Expected: PASS (sin errores).

- [ ] **Step 3: Commit (si aplica)**

```bash
git add src/features/merchants/types.ts
git commit -m "feat(merchants): domain types for merchant accounts"
```

---

## Task 2: Cálculo de economía (`economics.ts`) — TDD

**Files:**

- Create: `src/features/merchants/economics.test.ts`
- Create: `src/features/merchants/economics.ts`

- [ ] **Step 1: Escribir los tests primero**

```ts
import { describe, it, expect } from 'vitest'
import { computeMerchantEconomics, REFERENCE_AMOUNT } from './economics'
import type { CardRates } from './types'

const cost: CardRates = { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 }
const price: CardRates = { DEBIT: 0.02, CREDIT: 0.03, AMEX: 0.04, INTERNATIONAL: 0.045 }

describe('computeMerchantEconomics', () => {
  it('REFERENCE_AMOUNT es 100', () => {
    expect(REFERENCE_AMOUNT).toBe(100)
  })

  it('modo no-pricing: sin pricing y sin revenue-share → no calcula margen', () => {
    const r = computeMerchantEconomics({ cost, venuePrice: null, revenueShare: null })
    expect(r.mode).toBe('no-pricing')
    expect(r.byCard.DEBIT.avoqadoMargin).toBeNull()
    // El costo del proveedor sí se conoce
    expect(r.byCard.DEBIT.providerCostAmount).toBeCloseTo(1.5, 4)
  })

  it('modo all-avoqado: pricing presente, sin revenue-share → margen entero a Avoqado', () => {
    const r = computeMerchantEconomics({ cost, venuePrice: price, revenueShare: null })
    expect(r.mode).toBe('all-avoqado')
    // débito: venue paga 2% = $2.00; costo 1.5% = $1.50; margen $0.50, todo Avoqado
    expect(r.byCard.DEBIT.venueChargeAmount).toBeCloseTo(2.0, 4)
    expect(r.byCard.DEBIT.providerCostAmount).toBeCloseTo(1.5, 4)
    expect(r.byCard.DEBIT.avoqadoMargin).toBeCloseTo(0.5, 4)
  })

  it('modo direct-split: revenue-share sin agregador → margen partido provider↔Avoqado', () => {
    const r = computeMerchantEconomics({
      cost,
      venuePrice: price,
      revenueShare: {
        aggregatorPrice: null,
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: null,
        taxRate: 0.16,
      },
    })
    expect(r.mode).toBe('direct-split')
    // pool débito = 2.00 − 1.50 = 0.50; Avoqado 50% = 0.25
    expect(r.byCard.DEBIT.avoqadoMargin).toBeCloseTo(0.25, 4)
  })

  it('modo aggregator: aggregatorPrice presente → margen provider-side de Avoqado', () => {
    const aggregatorPrice: CardRates = {
      DEBIT: 0.02,
      CREDIT: 0.03,
      AMEX: 0.04,
      INTERNATIONAL: 0.045,
    }
    const r = computeMerchantEconomics({
      cost,
      venuePrice: null,
      revenueShare: {
        aggregatorPrice,
        avoqadoShareOfProviderMargin: 0.7,
        avoqadoShareOfAggregatorMargin: 0.7,
        taxRate: 0.16,
      },
    })
    expect(r.mode).toBe('aggregator')
    // débito: aggregatorPrice 2.00 − costo 1.50 = 0.50 de margen; Avoqado 70% = 0.35
    expect(r.byCard.DEBIT.avoqadoMargin).toBeCloseTo(0.35, 4)
    // lo que Avoqado le cobra al agregador
    expect(r.byCard.DEBIT.aggregatorPriceAmount).toBeCloseTo(2.0, 4)
  })
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run src/features/merchants/economics.test.ts`
Expected: FAIL ("computeMerchantEconomics is not defined" / módulo no existe).

- [ ] **Step 3: Implementar `economics.ts`**

```ts
/**
 * Cálculo de la economía de un merchant account, por tipo de tarjeta, sobre un
 * monto de referencia ($100). REPORT-TIME / proyección — NO toca el proceso de pago.
 *
 * 4 modos (additive, según qué datos existan):
 *   - no-pricing:   sólo costo del proveedor; no hay con qué calcular margen.
 *   - all-avoqado:  hay pricing al venue, sin MerchantRevenueShare → margen = precio − costo, todo Avoqado.
 *   - direct-split: MerchantRevenueShare con aggregatorPrice=null → 1 margen provider↔Avoqado.
 *   - aggregator:   MerchantRevenueShare con aggregatorPrice → Avoqado le cobra al agregador;
 *                   margen provider-side = aggregatorPrice − costo, split por avoqadoShareOfProviderMargin.
 *
 * El tramo agregador→venue (comisión por venue, VenueCommission) es per-venue y se
 * muestra en la sección Venues; no se promedia aquí (sería engañoso a nivel merchant).
 */
import { CARD_TYPES, type CardRates, type CardType } from './types'

export const REFERENCE_AMOUNT = 100

export type EconomicsMode = 'no-pricing' | 'all-avoqado' | 'direct-split' | 'aggregator'

export interface CardEconomics {
  /** Monto de referencia (REFERENCE_AMOUNT). */
  amount: number
  /** Lo que el proveedor nos cobra, en monto. */
  providerCostAmount: number
  /** Lo que le cobramos al venue (modos all-avoqado / direct-split), o null. */
  venueChargeAmount: number | null
  /** Lo que Avoqado le cobra al agregador (modo aggregator), o null. */
  aggregatorPriceAmount: number | null
  /** Margen que se queda Avoqado, en monto; null si no se puede calcular. */
  avoqadoMargin: number | null
}

export interface MerchantEconomics {
  mode: EconomicsMode
  byCard: Record<CardType, CardEconomics>
}

interface RevenueShareInput {
  aggregatorPrice: CardRates | null
  avoqadoShareOfProviderMargin: number
  avoqadoShareOfAggregatorMargin: number | null
  taxRate: number
}

export interface EconomicsInput {
  /** Tasas de costo del proveedor YA efectivas (con impuesto resuelto). */
  cost: CardRates
  /** Tasas que paga el venue YA efectivas, o null. */
  venuePrice: CardRates | null
  revenueShare: RevenueShareInput | null
}

function resolveMode(input: EconomicsInput): EconomicsMode {
  if (input.revenueShare?.aggregatorPrice) return 'aggregator'
  if (input.revenueShare) return 'direct-split'
  if (input.venuePrice) return 'all-avoqado'
  return 'no-pricing'
}

export function computeMerchantEconomics(input: EconomicsInput): MerchantEconomics {
  const mode = resolveMode(input)
  const A = REFERENCE_AMOUNT

  const byCard = {} as Record<CardType, CardEconomics>
  for (const card of CARD_TYPES) {
    const providerCostAmount = input.cost[card] * A
    let venueChargeAmount: number | null = null
    let aggregatorPriceAmount: number | null = null
    let avoqadoMargin: number | null = null

    if (mode === 'all-avoqado' && input.venuePrice) {
      venueChargeAmount = input.venuePrice[card] * A
      avoqadoMargin = venueChargeAmount - providerCostAmount
    } else if (mode === 'direct-split' && input.venuePrice && input.revenueShare) {
      venueChargeAmount = input.venuePrice[card] * A
      const pool = venueChargeAmount - providerCostAmount
      avoqadoMargin = pool * input.revenueShare.avoqadoShareOfProviderMargin
    } else if (mode === 'aggregator' && input.revenueShare?.aggregatorPrice) {
      aggregatorPriceAmount = input.revenueShare.aggregatorPrice[card] * A
      const providerMargin = aggregatorPriceAmount - providerCostAmount
      avoqadoMargin = providerMargin * input.revenueShare.avoqadoShareOfProviderMargin
    }

    byCard[card] = {
      amount: A,
      providerCostAmount,
      venueChargeAmount,
      aggregatorPriceAmount,
      avoqadoMargin,
    }
  }

  return { mode, byCard }
}
```

- [ ] **Step 4: Correr y verificar PASS**

Run: `npx vitest run src/features/merchants/economics.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit (si aplica)**

```bash
git add src/features/merchants/economics.ts src/features/merchants/economics.test.ts
git commit -m "feat(merchants): money-chain economics computation (4 modes) + tests"
```

---

## Task 3: Readiness (`readiness.ts`) — TDD

**Files:**

- Create: `src/features/merchants/readiness.test.ts`
- Create: `src/features/merchants/readiness.ts`

- [ ] **Step 1: Tests primero**

```ts
import { describe, it, expect } from 'vitest'
import { computeReadiness } from './readiness'
import type { MerchantAccount } from './types'

const base: MerchantAccount = {
  id: 'm1',
  provider: { id: 'p1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' },
  externalMerchantId: '9814275',
  alias: null,
  displayName: 'Cuenta Principal',
  active: true,
  displayOrder: 0,
  clabeNumber: null,
  bankName: null,
  accountHolder: null,
  hasCredentials: true,
  blumonSerialNumber: '2841548417',
  blumonPosId: '376',
  blumonEnvironment: 'SANDBOX',
  blumonMerchantId: null,
  angelpayAffiliation: null,
  angelpayMerchantName: null,
  aggregatorId: null,
  venues: [{ id: 'v1', name: 'Doña Simona', slug: 'dona-simona' }],
  terminals: [{ id: 't1', serialNumber: 'AVQD-2841548417' }],
  counts: { costStructures: 1, venueConfigs: 1, terminals: 1 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('computeReadiness', () => {
  it('marca ok credenciales/costo/slots/terminales cuando hay datos', () => {
    const r = computeReadiness(base, { hasSettlement: true })
    const by = Object.fromEntries(r.map((c) => [c.key, c.state]))
    expect(by.credentials).toBe('ok')
    expect(by.cost).toBe('ok')
    expect(by.slots).toBe('ok')
    expect(by.terminals).toBe('ok')
    expect(by.settlement).toBe('ok')
  })

  it('marca missing lo que falta', () => {
    const m = {
      ...base,
      hasCredentials: false,
      counts: { costStructures: 0, venueConfigs: 0, terminals: 0 },
    }
    const r = computeReadiness(m, { hasSettlement: false })
    const by = Object.fromEntries(r.map((c) => [c.key, c.state]))
    expect(by.credentials).toBe('missing')
    expect(by.cost).toBe('missing')
    expect(by.slots).toBe('missing')
    expect(by.terminals).toBe('missing')
    expect(by.settlement).toBe('missing')
  })
})
```

- [ ] **Step 2: Correr → FAIL**

Run: `npx vitest run src/features/merchants/readiness.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `readiness.ts`**

```ts
/**
 * Completitud operativa de un merchant account — la tira "readiness" que abre
 * el Overview. Cada chip responde: ¿está lista esta faceta para cobrar bien?
 *
 * `state`: 'ok' (configurado), 'missing' (falta, con copy accionable),
 * 'unknown' (no pudimos determinarlo — datos no cargados).
 */
import type { MerchantAccount } from './types'

export type ReadinessState = 'ok' | 'missing' | 'unknown'

export interface ReadinessChip {
  key: 'credentials' | 'cost' | 'settlement' | 'slots' | 'terminals'
  label: string
  state: ReadinessState
  /** Copy accionable cuando falta. */
  hint?: string
}

interface ReadinessExtras {
  /** ¿Existe al menos una SettlementConfiguration? (se carga aparte). */
  hasSettlement?: boolean
}

export function computeReadiness(
  m: MerchantAccount,
  extras: ReadinessExtras = {},
): ReadinessChip[] {
  const chip = (
    key: ReadinessChip['key'],
    label: string,
    ok: boolean,
    hint: string,
    knowable = true,
  ): ReadinessChip => ({
    key,
    label,
    state: !knowable ? 'unknown' : ok ? 'ok' : 'missing',
    hint: ok ? undefined : hint,
  })

  return [
    chip(
      'credentials',
      'Credenciales',
      m.hasCredentials,
      'Sin credenciales — la TPV no podrá cobrar.',
    ),
    chip(
      'cost',
      'Costo proveedor',
      m.counts.costStructures > 0,
      'Sin estructura de costos — no podemos calcular margen.',
    ),
    chip(
      'settlement',
      'Liquidación',
      extras.hasSettlement === true,
      'Sin días de liquidación configurados.',
      extras.hasSettlement !== undefined,
    ),
    chip('slots', 'Slots', m.counts.venueConfigs > 0, 'No está asignada a ningún venue.'),
    chip('terminals', 'Terminales', m.counts.terminals > 0, 'Sin terminales asignadas.'),
  ]
}
```

- [ ] **Step 4: Correr → PASS**

Run: `npx vitest run src/features/merchants/readiness.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit (si aplica)**

```bash
git add src/features/merchants/readiness.ts src/features/merchants/readiness.test.ts
git commit -m "feat(merchants): readiness rules + tests"
```

---

## Task 4: API client (`api.ts`)

**Files:**

- Create: `src/features/merchants/api.ts`

- [ ] **Step 1: Escribir el archivo completo**

```ts
/**
 * API client del feature Merchants. Namespace único `/api/v1/superadmin/*`
 * (cookies HTTP-only). Mapea raw→dominio (Decimals string→number).
 */
import { api } from '@/shared/lib/api'
import type {
  CardRates,
  MerchantAccount,
  MerchantProvider,
  MerchantRevenueShare,
  MerchantVenueConfig,
  ProviderCostStructure,
  SettlementConfiguration,
} from './types'

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : fallback
}

/* --- Lista + detalle --- */

interface MerchantListResponse {
  success: boolean
  data: RawMerchant[]
  count: number
}
interface RawMerchant {
  id: string
  provider: { id: string; code: string; name: string; type: MerchantProvider['type'] }
  externalMerchantId: string
  alias: string | null
  displayName: string | null
  active: boolean
  displayOrder: number
  clabeNumber: string | null
  bankName: string | null
  accountHolder: string | null
  hasCredentials: boolean
  blumonSerialNumber: string | null
  blumonPosId: string | null
  blumonEnvironment: string | null
  blumonMerchantId: string | null
  angelpayAffiliation: string | null
  angelpayMerchantName: string | null
  aggregatorId: string | null
  venues: { id: string; name: string; slug: string }[]
  terminals: { id: string; serialNumber: string }[]
  _count: { costStructures: number; venueConfigs: number; terminals: number }
  createdAt: string
  updatedAt: string
}

function mapMerchant(r: RawMerchant): MerchantAccount {
  return {
    id: r.id,
    provider: r.provider,
    externalMerchantId: r.externalMerchantId,
    alias: r.alias,
    displayName: r.displayName,
    active: r.active,
    displayOrder: r.displayOrder ?? 0,
    clabeNumber: r.clabeNumber,
    bankName: r.bankName,
    accountHolder: r.accountHolder,
    hasCredentials: r.hasCredentials ?? false,
    blumonSerialNumber: r.blumonSerialNumber,
    blumonPosId: r.blumonPosId,
    blumonEnvironment: r.blumonEnvironment,
    blumonMerchantId: r.blumonMerchantId,
    angelpayAffiliation: r.angelpayAffiliation,
    angelpayMerchantName: r.angelpayMerchantName,
    aggregatorId: r.aggregatorId,
    venues: r.venues ?? [],
    terminals: r.terminals ?? [],
    counts: {
      costStructures: r._count?.costStructures ?? 0,
      venueConfigs: r._count?.venueConfigs ?? 0,
      terminals: r._count?.terminals ?? 0,
    },
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export interface FetchMerchantsParams {
  providerId?: string
  active?: boolean
}

export async function fetchMerchants(
  params: FetchMerchantsParams = {},
): Promise<MerchantAccount[]> {
  const { data } = await api.get<MerchantListResponse>('/superadmin/merchant-accounts', { params })
  if (!Array.isArray(data?.data)) return []
  return data.data.map(mapMerchant)
}

export async function fetchMerchant(id: string): Promise<MerchantAccount | null> {
  try {
    const { data } = await api.get<{ data: RawMerchant }>(
      `/superadmin/merchant-accounts/${encodeURIComponent(id)}`,
    )
    return data?.data ? mapMerchant(data.data) : null
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null
    throw error
  }
}

/* --- Providers (filtro + futuro form de alta) --- */

export async function fetchProviders(): Promise<MerchantProvider[]> {
  const { data } = await api.get<{ data: MerchantProvider[] }>('/superadmin/payment-providers', {
    params: { active: true },
  })
  return Array.isArray(data?.data) ? data.data : []
}

/* --- Costo del proveedor (estructura activa) --- */

export async function fetchActiveCost(
  merchantAccountId: string,
): Promise<ProviderCostStructure | null> {
  try {
    const { data } = await api.get<{ data: Record<string, unknown> | null }>(
      `/superadmin/cost-structures/active/${encodeURIComponent(merchantAccountId)}`,
    )
    const c = data?.data
    if (!c) return null
    return {
      id: String(c.id),
      merchantAccountId,
      debitRate: num(c.debitRate),
      creditRate: num(c.creditRate),
      amexRate: num(c.amexRate),
      internationalRate: num(c.internationalRate),
      includesTax: (c.includesTax as boolean | null) ?? null,
      taxRate: num(c.taxRate, 0.16),
      fixedCostPerTransaction:
        c.fixedCostPerTransaction == null ? null : num(c.fixedCostPerTransaction),
      effectiveFrom: String(c.effectiveFrom),
      effectiveTo: (c.effectiveTo as string | null) ?? null,
      active: (c.active as boolean) ?? true,
    }
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null
    throw error
  }
}

/* --- Revenue-share (split agregador) --- */

export async function fetchRevenueShare(
  merchantAccountId: string,
): Promise<MerchantRevenueShare | null> {
  const { data } = await api.get<{ data: Record<string, unknown> | null }>(
    '/superadmin/merchant-revenue-shares/by-merchant',
    { params: { merchantAccountId } },
  )
  const r = data?.data
  if (!r) return null
  const ap = r.aggregatorPrice as Record<string, unknown> | null
  const aggregatorPrice: CardRates | null = ap
    ? {
        DEBIT: num(ap.DEBIT),
        CREDIT: num(ap.CREDIT),
        AMEX: num(ap.AMEX),
        INTERNATIONAL: num(ap.INTERNATIONAL),
      }
    : null
  return {
    id: String(r.id),
    merchantAccountId,
    aggregatorPrice,
    aggregatorPriceIncludesTax: (r.aggregatorPriceIncludesTax as boolean) ?? false,
    avoqadoShareOfProviderMargin: num(r.avoqadoShareOfProviderMargin, 0.5),
    avoqadoShareOfAggregatorMargin:
      r.avoqadoShareOfAggregatorMargin == null ? null : num(r.avoqadoShareOfAggregatorMargin),
    taxRate: num(r.taxRate, 0.16),
    active: (r.active as boolean) ?? true,
  }
}

/* --- Liquidación (todas las configs del merchant) --- */

export async function fetchSettlements(
  merchantAccountId: string,
): Promise<SettlementConfiguration[]> {
  const { data } = await api.get<{ data: Record<string, unknown>[] }>(
    '/superadmin/settlement-configurations',
    { params: { merchantAccountId } },
  )
  if (!Array.isArray(data?.data)) return []
  return data.data.map((s) => ({
    id: String(s.id),
    merchantAccountId,
    cardType: s.cardType as SettlementConfiguration['cardType'],
    settlementDays: num(s.settlementDays),
    settlementDayType: s.settlementDayType as SettlementConfiguration['settlementDayType'],
    cutoffTime: String(s.cutoffTime ?? ''),
    cutoffTimezone: String(s.cutoffTimezone ?? 'America/Mexico_City'),
    effectiveFrom: String(s.effectiveFrom),
    effectiveTo: (s.effectiveTo as string | null) ?? null,
  }))
}

/* --- Venues que referencian a la cuenta + slot --- */

export async function fetchVenueConfigs(merchantAccountId: string): Promise<MerchantVenueConfig[]> {
  const { data } = await api.get<{ data: Record<string, unknown>[] }>(
    `/superadmin/venue-pricing/configs-by-merchant/${encodeURIComponent(merchantAccountId)}`,
  )
  if (!Array.isArray(data?.data)) return []
  return data.data.map((c) => {
    const venue = (c.venue as { id: string; name: string; slug: string }) ?? {
      id: '',
      name: '—',
      slug: '',
    }
    const slot: MerchantVenueConfig['slot'] =
      c.primaryAccountId === merchantAccountId
        ? 'PRIMARY'
        : c.secondaryAccountId === merchantAccountId
          ? 'SECONDARY'
          : 'TERTIARY'
    return { venueId: venue.id, venue, slot }
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit (si aplica)**

```bash
git add src/features/merchants/api.ts
git commit -m "feat(merchants): API client over /superadmin namespace"
```

---

## Task 5: Hooks (`use-merchants.ts`)

**Files:**

- Create: `src/features/merchants/use-merchants.ts`

- [ ] **Step 1: Escribir el archivo completo**

```ts
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  fetchActiveCost,
  fetchMerchant,
  fetchMerchants,
  fetchProviders,
  fetchRevenueShare,
  fetchSettlements,
  fetchVenueConfigs,
  type FetchMerchantsParams,
} from './api'
import { cardRatesFromCost } from './types'
import { computeMerchantEconomics, type MerchantEconomics } from './economics'

export const MERCHANTS_QUERY_KEY = ['superadmin', 'merchants'] as const

export function useMerchants(params: FetchMerchantsParams = {}) {
  return useQuery({
    queryKey: [...MERCHANTS_QUERY_KEY, params],
    queryFn: () => fetchMerchants(params),
    staleTime: 30_000,
  })
}

export function useMerchant(id: string | undefined) {
  return useQuery({
    queryKey: [...MERCHANTS_QUERY_KEY, 'detail', id ?? null],
    queryFn: () => {
      if (!id) throw new Error('merchant id is required')
      return fetchMerchant(id)
    },
    enabled: !!id,
    staleTime: 15_000,
  })
}

export const PROVIDERS_QUERY_KEY = ['superadmin', 'payment-providers'] as const

export function useProviders() {
  return useQuery({
    queryKey: PROVIDERS_QUERY_KEY,
    queryFn: fetchProviders,
    staleTime: 5 * 60_000,
  })
}

/**
 * Bundle de economía del detalle: costo + revenue-share + settlement + venue-configs
 * en paralelo. Devuelve también `economics` ya computado (merchant-level) y
 * `hasSettlement` para el readiness.
 *
 * Nota: el pricing al venue (VenuePricingStructure) es per-venue/slot — en F1A
 * el modo all-avoqado/direct-split se queda sin `venuePrice` (mode 'no-pricing'
 * o 'aggregator'); el pricing entra en F2 cuando se editen tarifas por venue.
 */
export function useMerchantEconomicsData(id: string | undefined) {
  const results = useQueries({
    queries: [
      {
        queryKey: [...MERCHANTS_QUERY_KEY, 'cost', id ?? null],
        queryFn: () => fetchActiveCost(id as string),
        enabled: !!id,
        staleTime: 30_000,
      },
      {
        queryKey: [...MERCHANTS_QUERY_KEY, 'revenue-share', id ?? null],
        queryFn: () => fetchRevenueShare(id as string),
        enabled: !!id,
        staleTime: 30_000,
      },
      {
        queryKey: [...MERCHANTS_QUERY_KEY, 'settlement', id ?? null],
        queryFn: () => fetchSettlements(id as string),
        enabled: !!id,
        staleTime: 30_000,
      },
      {
        queryKey: [...MERCHANTS_QUERY_KEY, 'venue-configs', id ?? null],
        queryFn: () => fetchVenueConfigs(id as string),
        enabled: !!id,
        staleTime: 30_000,
      },
    ],
  })

  const [costQ, revShareQ, settlementQ, venueConfigsQ] = results
  const cost = costQ.data ?? null
  const revenueShare = revShareQ.data ?? null
  const settlements = settlementQ.data ?? []
  const venueConfigs = venueConfigsQ.data ?? []

  const economics: MerchantEconomics | null = cost
    ? computeMerchantEconomics({
        cost: cardRatesFromCost(cost),
        venuePrice: null,
        revenueShare: revenueShare
          ? {
              aggregatorPrice: revenueShare.aggregatorPrice,
              avoqadoShareOfProviderMargin: revenueShare.avoqadoShareOfProviderMargin,
              avoqadoShareOfAggregatorMargin: revenueShare.avoqadoShareOfAggregatorMargin,
              taxRate: revenueShare.taxRate,
            }
          : null,
      })
    : null

  return {
    cost,
    revenueShare,
    settlements,
    venueConfigs,
    economics,
    hasSettlement: settlements.length > 0,
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
    error: results.find((r) => r.isError)?.error ?? null,
    refetch: () => results.forEach((r) => void r.refetch()),
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit (si aplica)**

```bash
git add src/features/merchants/use-merchants.ts
git commit -m "feat(merchants): TanStack Query hooks (list, detail, economics bundle)"
```

---

## Task 6: `ReadinessStrip.tsx`

**Files:**

- Create: `src/features/merchants/ReadinessStrip.tsx`

- [ ] **Step 1: Escribir el componente**

```tsx
import { Check, X, HelpCircle } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { ReadinessChip } from './readiness'

/**
 * Tira de readiness del Overview. Estado "ok" = superficie elevada gris (nunca
 * blanco — sigue el patrón de SetupIcons). "missing" = tenue con tooltip de copy.
 */
export function ReadinessStrip({ items }: { items: ReadinessChip[] }) {
  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Completitud de la cuenta">
      {items.map((c) => (
        <span
          key={c.key}
          role="listitem"
          title={c.hint}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]',
            c.state === 'ok' && 'bg-[var(--canvas-raised)] text-[var(--ink)]',
            c.state === 'missing' && 'bg-[var(--danger-faint)] text-[var(--danger)]',
            c.state === 'unknown' && 'text-[var(--ink-faint)]',
          )}
        >
          {c.state === 'ok' ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : c.state === 'missing' ? (
            <X className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
          )}
          {c.label}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Test de componente**

Create `src/features/merchants/ReadinessStrip.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReadinessStrip } from './ReadinessStrip'

describe('ReadinessStrip', () => {
  it('muestra label y estado de cada chip', () => {
    render(
      <ReadinessStrip
        items={[
          { key: 'credentials', label: 'Credenciales', state: 'ok' },
          { key: 'cost', label: 'Costo proveedor', state: 'missing', hint: 'Falta' },
        ]}
      />,
    )
    expect(screen.getByText('Credenciales')).toBeInTheDocument()
    expect(screen.getByText('Costo proveedor')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Correr → PASS** · Run: `npx vitest run src/features/merchants/ReadinessStrip.test.tsx` · Expected: PASS.

- [ ] **Step 4: Commit (si aplica)**

```bash
git add src/features/merchants/ReadinessStrip.tsx src/features/merchants/ReadinessStrip.test.tsx
git commit -m "feat(merchants): ReadinessStrip component"
```

---

## Task 7: `MoneyFlow.tsx` (flujo escalonado del Overview)

**Files:**

- Create: `src/features/merchants/MoneyFlow.tsx`

- [ ] **Step 1: Escribir el componente**

```tsx
import { useState } from 'react'
import { Combobox } from '@/shared/ui/Combobox'
import { CARD_TYPES, humanizeCardType, type CardType } from './types'
import { REFERENCE_AMOUNT, type MerchantEconomics } from './economics'

const money = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

/**
 * Flujo de dinero escalonado para un tipo de tarjeta. Lee el `MerchantEconomics`
 * ya computado y narra la cadena según el modo. Degrada con elegancia: en
 * 'no-pricing' explica qué falta; en 'all-avoqado'/'direct-split' muestra
 * costo→precio→margen; en 'aggregator' muestra costo→precio al agregador→margen.
 */
export function MoneyFlow({ economics }: { economics: MerchantEconomics }) {
  const [card, setCard] = useState<CardType>('DEBIT')
  const e = economics.byCard[card]

  const rows: { label: string; amount: string; strong?: boolean; muted?: boolean }[] = []
  rows.push({ label: `Sobre ${money(REFERENCE_AMOUNT)} cobrados`, amount: '', muted: true })
  rows.push({
    label: 'Costo del proveedor',
    amount: `−${money(e.providerCostAmount)}`,
    muted: true,
  })

  if (economics.mode === 'no-pricing') {
    rows.push({
      label: 'Sin pricing configurado — no podemos calcular margen',
      amount: '',
      muted: true,
    })
  } else if (economics.mode === 'aggregator' && e.aggregatorPriceAmount != null) {
    rows.push({
      label: 'Precio a agregador (Avoqado cobra)',
      amount: money(e.aggregatorPriceAmount),
    })
    if (e.avoqadoMargin != null)
      rows.push({
        label: 'Margen Avoqado (lado proveedor)',
        amount: money(e.avoqadoMargin),
        strong: true,
      })
  } else if (e.venueChargeAmount != null) {
    rows.push({ label: 'Lo que paga el venue', amount: money(e.venueChargeAmount) })
    if (e.avoqadoMargin != null)
      rows.push({ label: 'Margen Avoqado', amount: money(e.avoqadoMargin), strong: true })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-[var(--ink)]">Flujo de dinero</h3>
        <div className="w-40">
          <Combobox
            value={card}
            onChange={(v) => setCard(v as CardType)}
            options={CARD_TYPES.map((c) => ({ value: c, label: humanizeCardType(c) }))}
            aria-label="Tipo de tarjeta"
          />
        </div>
      </div>
      <dl className="flex flex-col">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-1.5 last:border-0"
          >
            <dt
              className={
                r.muted
                  ? 'text-[13px] text-[var(--ink-faint)]'
                  : 'text-[13px] text-[var(--ink-muted)]'
              }
            >
              {r.label}
            </dt>
            <dd className={cnAmount(r.strong)}>{r.amount}</dd>
          </div>
        ))}
      </dl>
      {economics.mode === 'aggregator' && (
        <p className="text-[11.5px] text-[var(--ink-faint)]">
          El tramo agregador→venue (comisión por venue) se muestra por venue en la sección Venues.
        </p>
      )}
    </div>
  )
}

function cnAmount(strong?: boolean): string {
  return strong
    ? 'text-[14px] font-semibold tabular-nums text-[var(--success)]'
    : 'text-[13px] tabular-nums text-[var(--ink)]'
}
```

> Nota de ejecución: verifica la firma real de `Combobox` (`value`/`onChange`/`options`) en `src/shared/ui/Combobox.tsx` y ajusta props si difiere (p. ej. `onValueChange`). El resto del componente no cambia.

- [ ] **Step 2: Test**

Create `src/features/merchants/MoneyFlow.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MoneyFlow } from './MoneyFlow'
import { computeMerchantEconomics } from './economics'

describe('MoneyFlow', () => {
  it('explica el caso no-pricing', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: null,
      revenueShare: null,
    })
    render(<MoneyFlow economics={eco} />)
    expect(screen.getByText('Flujo de dinero')).toBeInTheDocument()
    expect(screen.getByText(/no podemos calcular margen/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Correr → PASS** · Run: `npx vitest run src/features/merchants/MoneyFlow.test.tsx`

- [ ] **Step 4: Commit (si aplica)**

```bash
git add src/features/merchants/MoneyFlow.tsx src/features/merchants/MoneyFlow.test.tsx
git commit -m "feat(merchants): MoneyFlow stepped breakdown"
```

---

## Task 8: `EconomicsTable.tsx` (tabla por tarjeta)

**Files:**

- Create: `src/features/merchants/EconomicsTable.tsx`

- [ ] **Step 1: Escribir el componente**

```tsx
import { CARD_TYPES, humanizeCardType } from './types'
import type { MerchantEconomics } from './economics'

const money = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

/** Tabla "estado de resultados" por tarjeta (sección Economía a fondo). */
export function EconomicsTable({ economics }: { economics: MerchantEconomics }) {
  const isAggregator = economics.mode === 'aggregator'
  return (
    <div className="overflow-x-auto rounded-[8px] border border-[var(--line-strong)]">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth: 480 }}>
        <thead>
          <tr className="border-b border-[var(--line-strong)] bg-[var(--canvas-sunken)]">
            <th className="eyebrow px-4 py-2.5 text-left">Concepto</th>
            {CARD_TYPES.map((c) => (
              <th key={c} className="eyebrow px-4 py-2.5 text-right">
                {humanizeCardType(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row
            label="Costo del proveedor"
            pick={(e) => money(-e.providerCostAmount)}
            economics={economics}
          />
          {isAggregator ? (
            <Row
              label="Precio a agregador"
              pick={(e) => money(e.aggregatorPriceAmount)}
              economics={economics}
            />
          ) : (
            <Row
              label="Paga el venue"
              pick={(e) => money(e.venueChargeAmount)}
              economics={economics}
            />
          )}
          <Row
            label="Margen Avoqado"
            pick={(e) => money(e.avoqadoMargin)}
            economics={economics}
            strong
          />
        </tbody>
      </table>
    </div>
  )
}

function Row({
  label,
  pick,
  economics,
  strong,
}: {
  label: string
  pick: (e: MerchantEconomics['byCard']['DEBIT']) => string
  economics: MerchantEconomics
  strong?: boolean
}) {
  return (
    <tr className="border-b border-[var(--line)] last:border-0">
      <td
        className={`px-4 py-2.5 ${strong ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-muted)]'}`}
      >
        {label}
      </td>
      {CARD_TYPES.map((c) => (
        <td
          key={c}
          className={`px-4 py-2.5 text-right tabular-nums ${strong ? 'font-semibold text-[var(--success)]' : 'text-[var(--ink)]'}`}
        >
          {pick(economics.byCard[c])}
        </td>
      ))}
    </tr>
  )
}
```

- [ ] **Step 2: Test**

Create `src/features/merchants/EconomicsTable.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EconomicsTable } from './EconomicsTable'
import { computeMerchantEconomics } from './economics'

describe('EconomicsTable', () => {
  it('renderiza fila de margen para el modo all-avoqado', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: { DEBIT: 0.02, CREDIT: 0.03, AMEX: 0.04, INTERNATIONAL: 0.045 },
      revenueShare: null,
    })
    render(<EconomicsTable economics={eco} />)
    expect(screen.getByText('Margen Avoqado')).toBeInTheDocument()
    expect(screen.getByText('Paga el venue')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Correr → PASS** · Run: `npx vitest run src/features/merchants/EconomicsTable.test.tsx`

- [ ] **Step 4: Commit (si aplica)**

```bash
git add src/features/merchants/EconomicsTable.tsx src/features/merchants/EconomicsTable.test.tsx
git commit -m "feat(merchants): EconomicsTable per-card breakdown"
```

---

## Task 9: `MerchantsPage.tsx` (lista)

**Files:**

- Create: `src/features/merchants/MerchantsPage.tsx`

- [ ] **Step 1: Escribir la página**

```tsx
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/shared/data-table/DataTable'
import { Badge } from '@/shared/ui/Badge'
import { iconButtonVariants } from '@/shared/ui/icon-button-variants'
import { QueryError } from '@/shared/components/QueryError'
import { useMerchants } from './use-merchants'
import { activeTone, environmentTone, humanizeEnvironment, type MerchantAccount } from './types'

export function MerchantsPage() {
  const query = useMerchants()
  const merchants = useMemo(() => query.data ?? [], [query.data])

  const columns = useMemo<ColumnDef<MerchantAccount, unknown>[]>(
    () => [
      {
        id: 'cuenta',
        header: 'Cuenta',
        accessorFn: (m) => m.displayName ?? m.alias ?? m.externalMerchantId,
        cell: ({ row }) => {
          const m = row.original
          return (
            <div className="flex flex-col">
              <span className="font-medium text-[var(--ink)]">
                {m.displayName ?? m.alias ?? m.externalMerchantId}
              </span>
              <span className="text-[12px] tabular-nums text-[var(--ink-faint)]">
                {m.externalMerchantId}
                {m.blumonSerialNumber ? ` · ${m.blumonSerialNumber}` : ''}
              </span>
            </div>
          )
        },
      },
      {
        id: 'provider',
        header: 'Proveedor',
        accessorFn: (m) => m.provider.name,
        cell: ({ row }) => (
          <Badge tone="muted" size="sm">
            {row.original.provider.name}
          </Badge>
        ),
      },
      {
        id: 'ambiente',
        header: 'Ambiente',
        accessorFn: (m) => m.blumonEnvironment ?? '',
        cell: ({ row }) =>
          row.original.blumonEnvironment ? (
            <Badge tone={environmentTone(row.original.blumonEnvironment)} size="sm">
              {humanizeEnvironment(row.original.blumonEnvironment)}
            </Badge>
          ) : (
            <span className="text-[var(--ink-faint)]">—</span>
          ),
      },
      {
        id: 'estado',
        header: 'Estado',
        accessorFn: (m) => (m.active ? 'Activa' : 'Inactiva'),
        cell: ({ row }) => (
          <Badge tone={activeTone(row.original.active)} size="sm">
            {row.original.active ? 'Activa' : 'Inactiva'}
          </Badge>
        ),
      },
      {
        id: 'cuentas',
        header: 'Costos · Venues · TPVs',
        enableSorting: false,
        cell: ({ row }) => {
          const c = row.original.counts
          return (
            <span className="tabular-nums text-[13px] text-[var(--ink-muted)]">
              {c.costStructures} · {c.venueConfigs} · {c.terminals}
            </span>
          )
        },
      },
      {
        id: 'acciones',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to={`/merchants/${row.original.id}`}
            className={iconButtonVariants({ size: 'sm' })}
            aria-label={`Abrir ${row.original.displayName ?? row.original.externalMerchantId}`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ),
        meta: { headerClassName: 'w-[56px]', cellClassName: 'text-right' },
      },
    ],
    [],
  )

  if (query.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <QueryError
          error={query.error}
          context="cargar los merchant accounts"
          onRetry={() => query.refetch()}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="display text-[22px] text-[var(--ink)]">Merchant accounts</h1>
        <p className="text-[13.5px] text-[var(--ink-muted)]">
          Cuentas de pago por proveedor — costos, liquidación y a qué venues sirven.
        </p>
      </header>

      <DataTable
        data={merchants}
        columns={columns}
        searchPlaceholder="Buscar por cuenta, proveedor, serial…"
        initialSorting={[{ id: 'estado', desc: false }]}
        emptyState={{
          title: 'No hay merchant accounts',
          description: 'Aún no se ha registrado ninguna cuenta de pago.',
        }}
        caption="Listado de merchant accounts"
      />
    </div>
  )
}
```

> Nota de ejecución: confirma props reales de `DataTable`/`Badge`/`QueryError` (ver `src/shared/data-table/DataTable.tsx`, `src/shared/ui/Badge.tsx`, `src/shared/components/QueryError.tsx`). Si `QueryError` no acepta `error: unknown`, envuélvelo con `inspectApiError` primero.

- [ ] **Step 2: Test de integración (MSW)**

Create `src/features/merchants/MerchantsPage.test.tsx`:

```tsx
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { MerchantsPage } from './MerchantsPage'

const baseURL = 'http://localhost:3000/api/v1'
const server = setupServer(
  http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
    HttpResponse.json({
      success: true,
      count: 1,
      data: [
        {
          id: 'm1',
          provider: { id: 'p1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' },
          externalMerchantId: '9814275',
          alias: null,
          displayName: 'Cuenta Principal',
          active: true,
          displayOrder: 0,
          clabeNumber: null,
          bankName: null,
          accountHolder: null,
          hasCredentials: true,
          blumonSerialNumber: '2841548417',
          blumonPosId: '376',
          blumonEnvironment: 'SANDBOX',
          blumonMerchantId: null,
          angelpayAffiliation: null,
          angelpayMerchantName: null,
          aggregatorId: null,
          venues: [],
          terminals: [],
          _count: { costStructures: 1, venueConfigs: 1, terminals: 1 },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('MerchantsPage', () => {
  it('lista los merchant accounts', async () => {
    renderWithProviders(<MerchantsPage />)
    await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
    expect(screen.getByText('Blumon')).toBeInTheDocument()
    expect(screen.getByText('Sandbox')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Correr → PASS** · Run: `npx vitest run src/features/merchants/MerchantsPage.test.tsx`

- [ ] **Step 4: Commit (si aplica)**

```bash
git add src/features/merchants/MerchantsPage.tsx src/features/merchants/MerchantsPage.test.tsx
git commit -m "feat(merchants): list page (/merchants)"
```

---

## Task 10: `MerchantDetailPage.tsx` (detalle seccionado, readiness-first)

**Files:**

- Create: `src/features/merchants/MerchantDetailPage.tsx`

- [ ] **Step 1: Escribir la página**

```tsx
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { QueryError } from '@/shared/components/QueryError'
import { formatDateTime } from '@/shared/lib/datetime'
import { useMerchant, useMerchantEconomicsData } from './use-merchants'
import { computeReadiness } from './readiness'
import { ReadinessStrip } from './ReadinessStrip'
import { MoneyFlow } from './MoneyFlow'
import { EconomicsTable } from './EconomicsTable'
import { activeTone, environmentTone, humanizeCardType, humanizeEnvironment } from './types'

export function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const merchantQ = useMerchant(id)
  const eco = useMerchantEconomicsData(id)

  if (merchantQ.isError) {
    return (
      <Shell>
        <QueryError
          error={merchantQ.error}
          context="cargar la cuenta"
          onRetry={() => merchantQ.refetch()}
        />
      </Shell>
    )
  }
  if (merchantQ.isLoading) {
    return (
      <Shell>
        <p className="text-[var(--ink-faint)]">Cargando…</p>
      </Shell>
    )
  }
  const m = merchantQ.data
  if (!m) {
    return (
      <Shell>
        <p className="text-[var(--ink-muted)]">Esta cuenta no existe o fue eliminada.</p>
      </Shell>
    )
  }

  const readiness = computeReadiness(m, { hasSettlement: eco.hasSettlement })

  return (
    <Shell>
      <Link
        to="/merchants"
        className="inline-flex items-center gap-1 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Merchants
      </Link>

      {/* Cabecera */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="display text-[20px] text-[var(--ink)]">
            {m.displayName ?? m.alias ?? m.externalMerchantId}
          </h1>
          <Badge tone="muted" size="sm">
            {m.provider.name}
          </Badge>
          {m.blumonEnvironment && (
            <Badge tone={environmentTone(m.blumonEnvironment)} size="sm">
              {humanizeEnvironment(m.blumonEnvironment)}
            </Badge>
          )}
          <Badge tone={activeTone(m.active)} size="sm">
            {m.active ? 'Activa' : 'Inactiva'}
          </Badge>
        </div>
        <p className="text-[12.5px] tabular-nums text-[var(--ink-faint)]">
          ext {m.externalMerchantId}
          {m.blumonSerialNumber ? ` · serial ${m.blumonSerialNumber}` : ''}
          {m.blumonPosId ? ` · posId ${m.blumonPosId}` : ''}
        </p>
      </header>

      <ReadinessStrip items={readiness} />

      {/* Overview: flujo de dinero + identidad/banco */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--canvas)] p-5">
          {eco.isError ? (
            <QueryError error={eco.error} context="cargar la economía" onRetry={eco.refetch} />
          ) : eco.economics ? (
            <MoneyFlow economics={eco.economics} />
          ) : (
            <p className="text-[13px] text-[var(--ink-faint)]">
              Sin estructura de costos — configura el costo del proveedor para ver la economía.
            </p>
          )}
        </div>
        <div className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--canvas)] p-5">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--ink)]">Identidad & banco</h3>
          <dl className="flex flex-col gap-1.5 text-[13px]">
            <Field label="Banco" value={m.bankName ?? '—'} />
            <Field label="CLABE" value={m.clabeNumber ?? '—'} />
            <Field label="Titular" value={m.accountHolder ?? '—'} />
            <Field label="Credenciales" value={m.hasCredentials ? 'Sí' : 'No'} />
          </dl>
        </div>
      </section>

      {/* Economía a fondo */}
      {eco.economics && (
        <Section title="Economía (por tarjeta)">
          <EconomicsTable economics={eco.economics} />
        </Section>
      )}

      {/* Liquidación */}
      <Section title="Liquidación">
        {eco.settlements.length === 0 ? (
          <Empty>Sin días de liquidación configurados.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {eco.settlements.map((s) => (
              <li
                key={s.id}
                className="flex justify-between border-b border-[var(--line)] py-1.5 last:border-0"
              >
                <span className="text-[var(--ink-muted)]">{humanizeCardType(s.cardType)}</span>
                <span className="tabular-nums text-[var(--ink)]">
                  D+{s.settlementDays}{' '}
                  {s.settlementDayType === 'BUSINESS_DAYS' ? 'hábiles' : 'naturales'} · corte{' '}
                  {s.cutoffTime}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Venues (slots) */}
      <Section title={`Venues (${eco.venueConfigs.length})`}>
        {eco.venueConfigs.length === 0 ? (
          <Empty>No está asignada a ningún venue.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {eco.venueConfigs.map((vc) => (
              <li
                key={vc.venueId}
                className="flex items-center justify-between border-b border-[var(--line)] py-1.5 last:border-0"
              >
                <Link to={`/venues/${vc.venueId}`} className="text-[var(--ink)] hover:underline">
                  {vc.venue.name}
                </Link>
                <Badge tone="muted" size="sm">
                  {vc.slot}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Terminales */}
      <Section title={`Terminales (${m.terminals.length})`}>
        {m.terminals.length === 0 ? (
          <Empty>Sin terminales asignadas.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {m.terminals.map((t) => (
              <li
                key={t.id}
                className="flex justify-between border-b border-[var(--line)] py-1.5 last:border-0"
              >
                <span className="tabular-nums text-[var(--ink)]">{t.serialNumber || t.id}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="text-[11.5px] text-[var(--ink-faint)]">
        Actualizada {formatDateTime(m.updatedAt)}
      </p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">{children}</div>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
      {children}
    </section>
  )
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--ink-faint)]">{label}</dt>
      <dd className="tabular-nums text-[var(--ink)]">{value}</dd>
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-[var(--ink-faint)]">{children}</p>
}
```

> Nota de ejecución: confirma la firma de `formatDateTime` (acepta `string` ISO; segundo arg opcional `tz`). Si `QueryError` requiere `inspectApiError`, ajusta. Verifica tokens de color (`--canvas`, `--line-strong`, `--ink-*`) contra `src/app/index.css`.

- [ ] **Step 2: Test de integración (MSW)**

Create `src/features/merchants/MerchantDetailPage.test.tsx`:

```tsx
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/render'
import { MerchantDetailPage } from './MerchantDetailPage'

const baseURL = 'http://localhost:3000/api/v1'
const merchant = {
  id: 'm1',
  provider: { id: 'p1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' },
  externalMerchantId: '9814275',
  alias: null,
  displayName: 'Cuenta Principal',
  active: true,
  displayOrder: 0,
  clabeNumber: '0001',
  bankName: 'BBVA',
  accountHolder: 'José A.',
  hasCredentials: true,
  blumonSerialNumber: '2841548417',
  blumonPosId: '376',
  blumonEnvironment: 'SANDBOX',
  blumonMerchantId: null,
  angelpayAffiliation: null,
  angelpayMerchantName: null,
  aggregatorId: null,
  venues: [],
  terminals: [],
  _count: { costStructures: 1, venueConfigs: 0, terminals: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}
const server = setupServer(
  http.get(`${baseURL}/superadmin/merchant-accounts/m1`, () =>
    HttpResponse.json({ data: merchant }),
  ),
  http.get(`${baseURL}/superadmin/cost-structures/active/m1`, () =>
    HttpResponse.json({
      data: {
        id: 'c1',
        debitRate: '0.015',
        creditRate: '0.025',
        amexRate: '0.035',
        internationalRate: '0.04',
        includesTax: true,
        taxRate: '0.16',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        active: true,
      },
    }),
  ),
  http.get(`${baseURL}/superadmin/merchant-revenue-shares/by-merchant`, () =>
    HttpResponse.json({ data: null }),
  ),
  http.get(`${baseURL}/superadmin/settlement-configurations`, () =>
    HttpResponse.json({ data: [] }),
  ),
  http.get(`${baseURL}/superadmin/venue-pricing/configs-by-merchant/m1`, () =>
    HttpResponse.json({ data: [] }),
  ),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('MerchantDetailPage', () => {
  it('muestra cabecera, readiness y economía', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/merchants/:id" element={<MerchantDetailPage />} />
      </Routes>,
      { initialEntries: ['/merchants/m1'] },
    )
    await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
    expect(screen.getByText('Credenciales')).toBeInTheDocument()
    expect(screen.getByText('Flujo de dinero')).toBeInTheDocument()
    expect(screen.getByText('BBVA')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Correr → PASS** · Run: `npx vitest run src/features/merchants/MerchantDetailPage.test.tsx`

- [ ] **Step 4: Commit (si aplica)**

```bash
git add src/features/merchants/MerchantDetailPage.tsx src/features/merchants/MerchantDetailPage.test.tsx
git commit -m "feat(merchants): detail page (sectioned, readiness-first)"
```

---

## Task 11: Wiring — router, sidebar, realtime

**Files:**

- Modify: `src/app/router.tsx`
- Modify: `src/shared/layouts/AppLayout.tsx`
- Modify: `src/features/realtime/use-realtime-invalidation.ts`

- [ ] **Step 1: Router — agregar lazy + rutas**

En `src/app/router.tsx`, junto a los demás `lazy(...)`:

```tsx
const MerchantsPage = lazy(() =>
  import('@/features/merchants/MerchantsPage').then((m) => ({ default: m.MerchantsPage })),
)
const MerchantDetailPage = lazy(() =>
  import('@/features/merchants/MerchantDetailPage').then((m) => ({
    default: m.MerchantDetailPage,
  })),
)
```

Dentro del `<Route element={<ProtectedRoute><AppLayout/></ProtectedRoute>}>`, después de las rutas de `/terminals`:

```tsx
<Route path="/merchants" element={<MerchantsPage />} />
<Route path="/merchants/:id" element={<MerchantDetailPage />} />
```

- [ ] **Step 2: Sidebar — habilitar `/merchants`**

En `src/shared/layouts/AppLayout.tsx`, en el item del nav, quita `disabled: true`:

```tsx
{ to: '/merchants', label: 'Merchant accounts', icon: CreditCard },
```

- [ ] **Step 3: Realtime — mapear evento**

En `src/features/realtime/use-realtime-invalidation.ts`, agrega al array `EVENT_INVALIDATIONS`:

```ts
['superadmin:merchant:updated', [['superadmin', 'merchants']]],
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS / build OK.

- [ ] **Step 5: Commit (si aplica)**

```bash
git add src/app/router.tsx src/shared/layouts/AppLayout.tsx src/features/realtime/use-realtime-invalidation.ts
git commit -m "feat(merchants): wire routes, sidebar nav, realtime invalidation"
```

---

## Task 12: MSW handlers compartidos (dev + tests default)

**Files:**

- Modify: `src/test/mocks/handlers.ts`

- [ ] **Step 1: Agregar handlers default**

Agrega al array `handlers` (devuelven vacío por default; los tests específicos los sobrescriben con `server.use`):

```ts
http.get(`${baseURL}/superadmin/merchant-accounts`, () =>
  HttpResponse.json({ success: true, data: [], count: 0 }),
),
http.get(`${baseURL}/superadmin/payment-providers`, () => HttpResponse.json({ data: [] })),
```

- [ ] **Step 2: Correr toda la suite**

Run: `npm run check`
Expected: lint + typecheck + tests verdes (incluye los nuevos).

- [ ] **Step 3: Commit (si aplica)**

```bash
git add src/test/mocks/handlers.ts
git commit -m "test(merchants): default MSW handlers for merchant endpoints"
```

---

## Task 13: Docs + gate final

**Files:**

- Modify: `CHANGELOG.md`, `README.md`

- [ ] **Step 1: CHANGELOG — `[Unreleased] · Added`**

```md
### Added

- **Merchant accounts (F1A):** página `/merchants` (listado) y detalle `/merchants/:id` de sólo lectura que hace legible la economía (costo proveedor → split agregador → margen Avoqado) + readiness por cuenta. Consume `/api/v1/superadmin/*` (revenue-shares y settlement ahora montados también ahí).
```

- [ ] **Step 2: README — registrar la página nueva**

Agrega `/merchants` a la lista de páginas top-level y nota el cambio de namespace del server.

- [ ] **Step 3: Gate impecable**

Run: `npm run check && npm run build`
Expected: todo verde, build OK.

Luego corre el audit de diseño: invoca `impeccable:audit`. Si hay issues ≥ "high", arréglalos en este mismo esfuerzo.

- [ ] **Step 4: Verificación visual (opcional pero recomendado)**

Run: `npm run dev` y navega a `/merchants` → abre una cuenta → confirma readiness + flujo de dinero + secciones. Para datos reales, prueba contra el server local con sesión superadmin.

- [ ] **Step 5: Commit (si aplica)**

```bash
git add CHANGELOG.md README.md
git commit -m "docs(merchants): changelog + readme for F1A"
```

---

## Self-review (cobertura del spec)

- §2 alcance F1 (lectura) → Tasks 9 (lista), 10 (detalle), 6–8 (viz). CRUD identidad = Parte B (fuera de este plan, por diseño).
- §6 contratos → Task 4 (api) con las rutas exactas (`/cost-structures/active/:id`, `/merchant-revenue-shares/by-merchant`, `/settlement-configurations`, `/venue-pricing/configs-by-merchant/:id`).
- §7 cambio server → Task 0 (mounts). `logAction` se difiere a Parte B (es escritura).
- §8 readiness → Task 3. §9 economía (3 modos + no-pricing) → Task 2.
- §10 layouts → Tasks 9/10. §13 testing → tests por task + Task 12. §15 docs → Task 13.
- Decisión de namespace de query keys (`['superadmin','merchants']`, distinta del selector de terminals) → documentada en el mapa de archivos y Task 5.

**Dependencias inter-fase:** Parte B (identity CRUD) reusa `api.ts`/`use-merchants.ts`/`types.ts` de esta Parte A y agrega mutations + `MerchantIdentityDrawer` + `logAction` server-side.
