# Retroactive Rate Correction — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a SUPERADMIN backend capability that, scoped to one venue + merchant account, recomputes the frozen economics of historical payments to a corrected card rate — previewed, audited (`ActivityLog`), and fully reversible via a `RateCorrectionBatch`.

**Architecture:** All work in `avoqado-server`. New endpoints under `/api/v1/superadmin/rate-corrections` (additive — legacy untouched). The recompute math is **forked** (copied) from the live `transactionCost.service.ts` into a pure, heavily-tested module so the live payment path is never modified (per CLAUDE.md "fork before changing shared logic"), with a cross-check test guarding drift. Each apply writes three snapshot tables consistently (`Payment`, `VenueTransaction`, `TransactionCost`) inside chunked transactions and records per-payment before-values for reversal.

**Tech Stack:** Express + TypeScript, Prisma/PostgreSQL, **Jest + ts-jest** (NOT Vitest), zod for validation, existing `logAction` activity-log service.

**Spec:** `docs/superpowers/specs/2026-05-26-retroactive-rate-correction-design.md`

> ⚠️ **TEST RUNNER CORRECTION (2026-05-26):** `avoqado-server` uses **Jest** (`ts-jest`), not Vitest. The Vitest-style test code in the tasks below must be written **Jest-style**:
>
> - **No** `import { describe, it, expect, vi } from 'vitest'` — `describe`/`it`/`expect`/`beforeEach` are Jest globals.
> - `vi.mock` → `jest.mock`, `vi.fn()` → `jest.fn()`, `vi.clearAllMocks()` → `jest.clearAllMocks()`.
> - Mock the Prisma client the canonical way: `jest.mock('@/utils/prismaClient', () => ({ __esModule: true, default: { <model>: { <method>: jest.fn() } } }))`. Also `jest.mock('@/config/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))` for services that log.
> - **Use the `@/` alias** for imports (jest `moduleNameMapper` resolves `@/*` → `src/*` and `@tests/*` → `tests/*`). e.g. `import prisma from '@/utils/prismaClient'`. This also makes the `@/`-import chain (e.g. `transactionCost.service`) resolve cleanly — no need to mock a whole module just to dodge alias resolution.
> - Tests live at `tests/unit/**/*.test.ts`. Run a single file: **`npx jest tests/unit/services/superadmin/rateCorrection/<file>.test.ts`** (NOT vitest). Setup file `tests/__helpers__/setup.ts` sets a dummy `DATABASE_URL` so mocked prisma never connects.
> - Coverage threshold is **70%** global (not 60%).

---

## File Structure

```
avoqado-server/
├── prisma/schema.prisma                                            # +2 models, +2 enums, +back-relations  (Task 1)
├── src/services/superadmin/rateCorrection/
│   ├── rateRecompute.ts            # PURE math, forked from transactionCost.service.ts   (Task 2)
│   ├── rateCorrectionScope.ts      # accountType→merchantAccount, payment query          (Task 3)
│   ├── rateCorrectionPreview.ts    # dry-run aggregate (no writes)                       (Task 5)
│   ├── rateCorrectionApply.ts      # write 3 tables + entries + batch + activity log     (Task 6)
│   ├── rateCorrectionReverse.ts    # restore before-values                               (Task 7)
│   └── rateCorrectionList.ts       # list batches                                        (Task 8)
├── src/controllers/superadmin/rateCorrection.controller.ts         # thin controllers    (Task 9)
├── src/schemas/superadmin/rateCorrection.schema.ts                 # zod bodies          (Task 9)
├── src/routes/superadmin/rateCorrection.routes.ts                  # router              (Task 9)
├── src/routes/superadmin.routes.ts                                 # mount router        (Task 9)
└── tests/unit/services/superadmin/rateCorrection/*.test.ts         # tests per module
```

> **Server test convention:** tests live under `tests/unit/services/...` (mirrors `reservation.dashboard.service.test.ts`, `earnings.service.test.ts`). Run a single file with `npx vitest run tests/unit/services/superadmin/rateCorrection/<file>.test.ts`.

> **Decided defaults (spec §10/§9):** backend first; sync vs background threshold = **200 payments** (this plan implements the synchronous path + a hard guard that rejects > 200 with a clear error, leaving the background job as a follow-up task — see Task 6 note); entries kept forever; any SUPERADMIN may apply.

---

## Task 1: Prisma models, enums, migration

**Files:**

- Modify: `avoqado-server/prisma/schema.prisma`
- Test: `avoqado-server/tests/unit/services/superadmin/rateCorrection/model.test.ts`

- [ ] **Step 1: Add enums + models to schema.prisma**

Append near the other payment-economics models (after `TransactionCost`, around line 4231):

```prisma
enum RateCorrectionStatus {
  PENDING
  APPLIED
  FAILED
  REVERSED
}

enum RateCorrectionMissingCostMode {
  FIX_PAYMENT_ONLY
  CREATE_COST
}

/// Audit + reversal record for a retroactive rate correction applied to the
/// historical payments of ONE venue + merchant account. See
/// docs/superpowers/specs/2026-05-26-retroactive-rate-correction-design.md
model RateCorrectionBatch {
  id                String          @id @default(cuid())
  venueId           String
  venue             Venue           @relation(fields: [venueId], references: [id], onDelete: Cascade)
  merchantAccountId String
  merchantAccount   MerchantAccount @relation(fields: [merchantAccountId], references: [id])
  accountType       AccountType

  // Full pricing snapshot before/after (debit/credit/amex/international + includesTax + taxRate + fixedFee)
  oldRates Json
  newRates Json

  dateFrom        DateTime?
  dateTo          DateTime?
  missingCostMode RateCorrectionMissingCostMode

  status           RateCorrectionStatus @default(PENDING)
  paymentCount     Int                  @default(0)
  costCreatedCount Int                  @default(0)
  estimatedImpact  Decimal              @default(0) @db.Decimal(14, 4) // Δ in total venue fee (after − before)

  appliedById String?
  appliedBy   Staff?    @relation("RateCorrectionAppliedBy", fields: [appliedById], references: [id], onDelete: SetNull)
  appliedAt   DateTime?
  reversedById String?
  reversedBy   Staff?   @relation("RateCorrectionReversedBy", fields: [reversedById], references: [id], onDelete: SetNull)
  reversedAt   DateTime?

  failureReason String?

  entries RateCorrectionEntry[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([venueId])
  @@index([merchantAccountId])
  @@index([status])
  @@index([createdAt])
}

/// Per-payment before/after snapshot — the source of truth for reversal.
model RateCorrectionEntry {
  id        String              @id @default(cuid())
  batchId   String
  batch     RateCorrectionBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  paymentId String
  payment   Payment             @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  // BEFORE (for reversal)
  beforeFeeAmount             Decimal  @db.Decimal(12, 4)
  beforeNetAmount             Decimal  @db.Decimal(12, 4)
  beforeFeePercentage         Decimal  @db.Decimal(5, 4)
  beforeVenueTxnFee           Decimal? @db.Decimal(12, 4)
  beforeVenueTxnNet           Decimal? @db.Decimal(12, 4)
  beforeVenueTxnNetSettlement Decimal? @db.Decimal(12, 4)
  costCreated                 Boolean  @default(false) // true → this batch created the TransactionCost; reversal deletes it
  beforeCostJson              Json? // full TransactionCost row before (null if costCreated)

  // AFTER (audit)
  afterFeeAmount     Decimal @db.Decimal(12, 4)
  afterNetAmount     Decimal @db.Decimal(12, 4)
  afterFeePercentage Decimal @db.Decimal(5, 4)

  createdAt DateTime @default(now())

  @@unique([batchId, paymentId])
  @@index([batchId])
  @@index([paymentId])
}
```

- [ ] **Step 2: Add back-relations to existing models**

In `model Venue { ... }` add: `rateCorrectionBatches RateCorrectionBatch[]`
In `model MerchantAccount { ... }` add: `rateCorrectionBatches RateCorrectionBatch[]`
In `model Payment { ... }` add: `rateCorrectionEntries RateCorrectionEntry[]`
In `model Staff { ... }` add: `rateCorrectionsApplied  RateCorrectionBatch[] @relation("RateCorrectionAppliedBy")` and `rateCorrectionsReversed RateCorrectionBatch[] @relation("RateCorrectionReversedBy")`

- [ ] **Step 3: Create the migration (no data change)**

Run: `cd avoqado-server && npx prisma migrate dev --name add_rate_correction_batch`
Expected: migration created + applied to local dev DB; `prisma generate` runs. Output ends with "Your database is now in sync with your schema."

- [ ] **Step 4: Write a smoke test that the Prisma client exposes the models**

`tests/unit/services/superadmin/rateCorrection/model.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import prisma from '../../../../../src/utils/prismaClient'

describe('RateCorrection models', () => {
  it('exposes rateCorrectionBatch and rateCorrectionEntry delegates', () => {
    expect(prisma.rateCorrectionBatch).toBeDefined()
    expect(prisma.rateCorrectionEntry).toBeDefined()
  })
})
```

- [ ] **Step 5: Run it** — `npx vitest run tests/unit/services/superadmin/rateCorrection/model.test.ts` → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(rate-correction): add RateCorrectionBatch/Entry models + migration"`

---

## Task 2: Pure recompute math (forked from live path)

**Why fork:** the math lives inline in `src/services/payments/transactionCost.service.ts:300-341,386-388`. Copying it into a pure module keeps the live payment path untouched (CLAUDE.md rule) and makes it unit-testable. A cross-check test (Step 4) guards against drift.

**Files:**

- Create: `avoqado-server/src/services/superadmin/rateCorrection/rateRecompute.ts`
- Test: `avoqado-server/tests/unit/services/superadmin/rateCorrection/rateRecompute.test.ts`

- [ ] **Step 1: Write the failing tests** (`rateRecompute.test.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { TransactionCardType } from '@prisma/client'
import {
  recomputeEconomics,
  getRateForTransactionType,
  applyTaxIfNeeded,
} from '../../../../../src/services/superadmin/rateCorrection/rateRecompute'

const venuePricing = (over = {}) => ({
  debitRate: 0.02,
  creditRate: 0.055,
  amexRate: 0.04,
  internationalRate: 0.045,
  includesTax: true,
  taxRate: 0.16,
  fixedFeePerTransaction: 0,
  ...over,
})
const providerCost = (over = {}) => ({
  debitRate: 0.01,
  creditRate: 0.02,
  amexRate: 0.025,
  internationalRate: 0.03,
  includesTax: true,
  taxRate: 0.16,
  fixedCostPerTransaction: 0,
  ...over,
})

describe('getRateForTransactionType', () => {
  it('selects the rate column by card type', () => {
    expect(getRateForTransactionType(venuePricing(), TransactionCardType.CREDIT)).toBe(0.055)
    expect(getRateForTransactionType(venuePricing(), TransactionCardType.DEBIT)).toBe(0.02)
    expect(getRateForTransactionType(venuePricing(), TransactionCardType.AMEX)).toBe(0.04)
    expect(getRateForTransactionType(venuePricing(), TransactionCardType.INTERNATIONAL)).toBe(0.045)
  })
  it('falls back to credit for OTHER', () => {
    expect(getRateForTransactionType(venuePricing(), TransactionCardType.OTHER)).toBe(0.055)
  })
})

describe('applyTaxIfNeeded', () => {
  it('returns base rate when includesTax is true', () => {
    expect(applyTaxIfNeeded(venuePricing({ includesTax: true }), 0.055)).toBeCloseTo(0.055, 10)
  })
  it('returns base rate when includesTax is null (legacy)', () => {
    expect(applyTaxIfNeeded(venuePricing({ includesTax: null }), 0.055)).toBeCloseTo(0.055, 10)
  })
  it('adds tax when includesTax is false', () => {
    expect(applyTaxIfNeeded(venuePricing({ includesTax: false, taxRate: 0.16 }), 0.05)).toBeCloseTo(
      0.058,
      10,
    )
  })
  it('honors a 0 taxRate (no-IVA jurisdiction) instead of defaulting to 16%', () => {
    expect(applyTaxIfNeeded(venuePricing({ includesTax: false, taxRate: 0 }), 0.05)).toBeCloseTo(
      0.05,
      10,
    )
  })
})

describe('recomputeEconomics', () => {
  it('computes fee/net/profit for a credit payment with includesTax=true', () => {
    const r = recomputeEconomics({
      amount: 1000,
      transactionType: TransactionCardType.CREDIT,
      venuePricing: venuePricing(),
      providerCost: providerCost(),
    })
    expect(r.venueRate).toBeCloseTo(0.055, 10)
    expect(r.venueChargeAmount).toBeCloseTo(55, 6) // 1000 * 0.055
    expect(r.feeAmount).toBeCloseTo(55, 6) // venueCharge + venueFixedFee(0)
    expect(r.netAmount).toBeCloseTo(945, 6) // amount - fee
    expect(r.providerCostAmount).toBeCloseTo(20, 6) // 1000 * 0.02
    expect(r.grossProfit).toBeCloseTo(35, 6) // 55 - 20
    expect(r.profitMargin).toBeCloseTo(35 / 55, 10)
  })
  it('treats missing providerCost as zero cost (margin = full venue charge)', () => {
    const r = recomputeEconomics({
      amount: 1000,
      transactionType: TransactionCardType.CREDIT,
      venuePricing: venuePricing(),
      providerCost: null,
    })
    expect(r.providerCostAmount).toBe(0)
    expect(r.grossProfit).toBeCloseTo(55, 6)
  })
  it('applies fixed fees on both sides', () => {
    const r = recomputeEconomics({
      amount: 100,
      transactionType: TransactionCardType.DEBIT,
      venuePricing: venuePricing({ fixedFeePerTransaction: 1 }),
      providerCost: providerCost({ fixedCostPerTransaction: 0.5 }),
    })
    expect(r.feeAmount).toBeCloseTo(100 * 0.02 + 1, 6) // 3
    expect(r.grossProfit).toBeCloseTo(3 - (100 * 0.01 + 0.5), 6) // 3 - 1.5 = 1.5
  })
})
```

- [ ] **Step 2: Run → FAIL** (`Cannot find module '.../rateRecompute'`).

- [ ] **Step 3: Implement `rateRecompute.ts`** (math copied verbatim from `transactionCost.service.ts`):

```ts
import { TransactionCardType } from '@prisma/client'

/** Minimal shape of a VenuePricingStructure / ProviderCostStructure row (Decimal-or-number tolerant). */
export interface RateStructureLike {
  debitRate: number | string
  creditRate: number | string
  amexRate: number | string
  internationalRate: number | string
  includesTax?: boolean | null
  taxRate?: number | string | null
  fixedFeePerTransaction?: number | string | null // venue side
  fixedCostPerTransaction?: number | string | null // provider side
}

export interface RecomputeInput {
  /** base + tip — processors charge commission on the full amount that crosses the terminal */
  amount: number
  transactionType: TransactionCardType
  venuePricing: RateStructureLike
  providerCost?: RateStructureLike | null
}

export interface RecomputeResult {
  venueRate: number
  venueChargeAmount: number
  venueFixedFee: number
  feeAmount: number
  netAmount: number
  providerRate: number
  providerCostAmount: number
  providerFixedFee: number
  grossProfit: number
  profitMargin: number
}

// ---- forked from transactionCost.service.ts (keep in sync; guarded by cross-check test) ----
export function getRateForTransactionType(
  structure: RateStructureLike,
  t: TransactionCardType,
): number {
  switch (t) {
    case TransactionCardType.DEBIT:
      return parseFloat(structure.debitRate.toString())
    case TransactionCardType.CREDIT:
      return parseFloat(structure.creditRate.toString())
    case TransactionCardType.AMEX:
      return parseFloat(structure.amexRate.toString())
    case TransactionCardType.INTERNATIONAL:
      return parseFloat(structure.internationalRate.toString())
    default:
      return parseFloat(structure.creditRate.toString())
  }
}

export function applyTaxIfNeeded(
  structure: RateStructureLike | null | undefined,
  baseRate: number,
): number {
  if (structure?.includesTax === false) {
    let tax = 0.16
    if (structure.taxRate !== null && structure.taxRate !== undefined) {
      const parsed = parseFloat(structure.taxRate.toString())
      if (Number.isFinite(parsed)) tax = parsed
    }
    return baseRate * (1 + tax)
  }
  return baseRate
}

export function recomputeEconomics(input: RecomputeInput): RecomputeResult {
  const { amount, transactionType, venuePricing, providerCost } = input

  const venueRate = applyTaxIfNeeded(
    venuePricing,
    getRateForTransactionType(venuePricing, transactionType),
  )
  const venueFixedFee = venuePricing.fixedFeePerTransaction
    ? parseFloat(venuePricing.fixedFeePerTransaction.toString())
    : 0
  const venueChargeAmount = amount * venueRate

  let providerRate = 0
  let providerFixedFee = 0
  if (providerCost) {
    providerRate = applyTaxIfNeeded(
      providerCost,
      getRateForTransactionType(providerCost, transactionType),
    )
    providerFixedFee = providerCost.fixedCostPerTransaction
      ? parseFloat(providerCost.fixedCostPerTransaction.toString())
      : 0
  }
  const providerCostAmount = amount * providerRate

  const feeAmount = venueChargeAmount + venueFixedFee
  const netAmount = amount - feeAmount
  const totalProviderCost = providerCostAmount + providerFixedFee
  const grossProfit = feeAmount - totalProviderCost
  const profitMargin = feeAmount > 0 ? grossProfit / feeAmount : 0

  return {
    venueRate,
    venueChargeAmount,
    venueFixedFee,
    feeAmount,
    netAmount,
    providerRate,
    providerCostAmount,
    providerFixedFee,
    grossProfit,
    profitMargin,
  }
}
```

- [ ] **Step 4: Add a drift cross-check test** — assert this matches the live formula's shape for a representative case. Append to `rateRecompute.test.ts`:

```ts
describe('parity with live transactionCost math', () => {
  it('venueRate/feeAmount match the documented live formula (amount incl. tip, fee = charge + fixed, net = amount - fee)', () => {
    const amount = 1234.56
    const r = recomputeEconomics({
      amount,
      transactionType: TransactionCardType.CREDIT,
      venuePricing: {
        debitRate: 0.02,
        creditRate: 0.03,
        amexRate: 0.04,
        internationalRate: 0.045,
        includesTax: false,
        taxRate: 0.16,
        fixedFeePerTransaction: 2,
      },
      providerCost: null,
    })
    const expectedVenueRate = 0.03 * 1.16
    expect(r.venueRate).toBeCloseTo(expectedVenueRate, 10)
    expect(r.feeAmount).toBeCloseTo(amount * expectedVenueRate + 2, 6)
    expect(r.netAmount).toBeCloseTo(amount - (amount * expectedVenueRate + 2), 6)
  })
})
```

- [ ] **Step 5: Run → PASS.** `npx vitest run tests/unit/services/superadmin/rateCorrection/rateRecompute.test.ts`

- [ ] **Step 6: Commit** — `git commit -am "feat(rate-correction): pure recompute math forked from live cost path + tests"`

---

## Task 3: Scope resolution (accountType → merchantAccount + payment query)

**Files:**

- Create: `avoqado-server/src/services/superadmin/rateCorrection/rateCorrectionScope.ts`
- Test: `avoqado-server/tests/unit/services/superadmin/rateCorrection/rateCorrectionScope.test.ts`

**Behavior:** Given `(venueId, accountType)`, resolve the `merchantAccountId` from `VenuePaymentConfig` (`primaryAccountId` / `secondaryAccountId` / `tertiaryAccountId`). Build the Prisma `where` for in-scope payments: `venueId`, `merchantAccountId`, `status = COMPLETED`, `originSystem = AVOQADO`, `method != CASH`, `type != TEST`, and optional `createdAt` range.

- [ ] **Step 1: Write failing tests** (use a mocked prisma):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentMethod, OriginSystem, TransactionStatus } from '@prisma/client'

vi.mock('../../../../../src/utils/prismaClient', () => ({
  default: { venuePaymentConfig: { findUnique: vi.fn() } },
}))
import prisma from '../../../../../src/utils/prismaClient'
import {
  resolveMerchantAccountId,
  buildScopeWhere,
} from '../../../../../src/services/superadmin/rateCorrection/rateCorrectionScope'

describe('resolveMerchantAccountId', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns primaryAccountId for PRIMARY', async () => {
    ;(prisma.venuePaymentConfig.findUnique as any).mockResolvedValue({
      primaryAccountId: 'ma_1',
      secondaryAccountId: 'ma_2',
      tertiaryAccountId: null,
    })
    expect(await resolveMerchantAccountId('v1', 'PRIMARY')).toBe('ma_1')
  })
  it('returns secondaryAccountId for SECONDARY', async () => {
    ;(prisma.venuePaymentConfig.findUnique as any).mockResolvedValue({
      primaryAccountId: 'ma_1',
      secondaryAccountId: 'ma_2',
      tertiaryAccountId: null,
    })
    expect(await resolveMerchantAccountId('v1', 'SECONDARY')).toBe('ma_2')
  })
  it('throws when the account for that type is not configured', async () => {
    ;(prisma.venuePaymentConfig.findUnique as any).mockResolvedValue({
      primaryAccountId: 'ma_1',
      secondaryAccountId: null,
      tertiaryAccountId: null,
    })
    await expect(resolveMerchantAccountId('v1', 'TERTIARY')).rejects.toThrow()
  })
  it('throws when the venue has no payment config', async () => {
    ;(prisma.venuePaymentConfig.findUnique as any).mockResolvedValue(null)
    await expect(resolveMerchantAccountId('v1', 'PRIMARY')).rejects.toThrow()
  })
})

describe('buildScopeWhere', () => {
  it('filters to COMPLETED / AVOQADO / non-CASH / non-TEST', () => {
    const w = buildScopeWhere({ venueId: 'v1', merchantAccountId: 'ma_1' })
    expect(w.venueId).toBe('v1')
    expect(w.merchantAccountId).toBe('ma_1')
    expect(w.status).toBe(TransactionStatus.COMPLETED)
    expect(w.originSystem).toBe(OriginSystem.AVOQADO)
    expect(w.method).toEqual({ not: PaymentMethod.CASH })
    expect(w.type).toEqual({ not: 'TEST' })
    expect(w.createdAt).toBeUndefined()
  })
  it('adds a createdAt range when dates are given', () => {
    const from = new Date('2024-01-01T00:00:00Z')
    const to = new Date('2024-06-01T00:00:00Z')
    const w = buildScopeWhere({
      venueId: 'v1',
      merchantAccountId: 'ma_1',
      dateFrom: from,
      dateTo: to,
    })
    expect(w.createdAt).toEqual({ gte: from, lte: to })
  })
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `rateCorrectionScope.ts`:**

```ts
import { AccountType, OriginSystem, PaymentMethod, Prisma, TransactionStatus } from '@prisma/client'
import prisma from '../../../utils/prismaClient'
import { BadRequestError } from '../../../errors/AppError'

export async function resolveMerchantAccountId(
  venueId: string,
  accountType: AccountType,
): Promise<string> {
  const config = await prisma.venuePaymentConfig.findUnique({ where: { venueId } })
  if (!config) throw new BadRequestError(`Venue ${venueId} has no payment configuration`)
  const id =
    accountType === AccountType.PRIMARY
      ? config.primaryAccountId
      : accountType === AccountType.SECONDARY
        ? config.secondaryAccountId
        : config.tertiaryAccountId
  if (!id)
    throw new BadRequestError(`Venue ${venueId} has no ${accountType} merchant account configured`)
  return id
}

export interface ScopeArgs {
  venueId: string
  merchantAccountId: string
  dateFrom?: Date
  dateTo?: Date
}

export function buildScopeWhere(args: ScopeArgs): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = {
    venueId: args.venueId,
    merchantAccountId: args.merchantAccountId,
    status: TransactionStatus.COMPLETED,
    originSystem: OriginSystem.AVOQADO,
    method: { not: PaymentMethod.CASH },
    type: { not: 'TEST' },
  }
  if (args.dateFrom || args.dateTo) {
    where.createdAt = {
      ...(args.dateFrom ? { gte: args.dateFrom } : {}),
      ...(args.dateTo ? { lte: args.dateTo } : {}),
    }
  }
  return where
}
```

> Verify the `VenuePaymentConfig` field names (`primaryAccountId` etc.) against `schema.prisma` before implementing; if the column names differ, adjust the three reads. (The relations are `PrimaryAccount`/`SecondaryAccount`/`TertiaryAccount`, so the scalar FKs are `primaryAccountId`/`secondaryAccountId`/`tertiaryAccountId`.)

- [ ] **Step 4: Run → PASS.** **Step 5: Commit** — `git commit -am "feat(rate-correction): scope resolution"`

---

## Task 4: Recompute a single payment (read venue/cost structures, compute before/after)

**Files:**

- Modify: `avoqado-server/src/services/superadmin/rateCorrection/rateCorrectionPreview.ts` (created here; preview aggregation added in Task 5)
- Test: `avoqado-server/tests/unit/services/superadmin/rateCorrection/recomputePayment.test.ts`

**Behavior:** `recomputePaymentEconomics(payment, venuePricing, providerCost)` → uses `determineTransactionCardType` (imported from the live service — read-only reuse, safe) + `recomputeEconomics`. Amount = `payment.amount + payment.tipAmount`. Returns `{ transactionType, after: RecomputeResult }`.

- [ ] **Step 1: Failing test:**

```ts
import { describe, it, expect } from 'vitest'
import { PaymentMethod, CardBrand, TransactionCardType } from '@prisma/client'
import { recomputePaymentEconomics } from '../../../../../src/services/superadmin/rateCorrection/rateCorrectionPreview'

const venuePricing = {
  debitRate: 0.02,
  creditRate: 0.055,
  amexRate: 0.04,
  internationalRate: 0.045,
  includesTax: true,
  taxRate: 0.16,
  fixedFeePerTransaction: 0,
}

describe('recomputePaymentEconomics', () => {
  it('uses amount + tip and the card-brand-derived type', () => {
    const payment: any = {
      amount: '900',
      tipAmount: '100',
      method: PaymentMethod.CREDIT_CARD,
      cardBrand: CardBrand.VISA,
      processorData: null,
    }
    const r = recomputePaymentEconomics(payment, venuePricing, null)
    expect(r.transactionType).toBe(TransactionCardType.CREDIT)
    expect(r.after.feeAmount).toBeCloseTo(1000 * 0.055, 6) // (900+100)*0.055 = 55
    expect(r.after.netAmount).toBeCloseTo(945, 6)
  })
  it('routes AMEX brand to the AMEX tier', () => {
    const payment: any = {
      amount: '1000',
      tipAmount: '0',
      method: PaymentMethod.CREDIT_CARD,
      cardBrand: CardBrand.AMERICAN_EXPRESS,
      processorData: null,
    }
    const r = recomputePaymentEconomics(payment, venuePricing, null)
    expect(r.transactionType).toBe(TransactionCardType.AMEX)
    expect(r.after.feeAmount).toBeCloseTo(40, 6)
  })
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement (top of `rateCorrectionPreview.ts`):**

```ts
import { Payment } from '@prisma/client'
import { determineTransactionCardType } from '../../payments/transactionCost.service' // read-only reuse (safe)
import { recomputeEconomics, RateStructureLike, RecomputeResult } from './rateRecompute'

export function recomputePaymentEconomics(
  payment: Pick<Payment, 'amount' | 'tipAmount' | 'method' | 'cardBrand' | 'processorData'>,
  venuePricing: RateStructureLike,
  providerCost: RateStructureLike | null,
): { transactionType: ReturnType<typeof determineTransactionCardType>; after: RecomputeResult } {
  const isInternational = (payment.processorData as any)?.isInternational || false
  const transactionType = determineTransactionCardType(
    payment.method,
    payment.cardBrand,
    isInternational,
  )
  const amount =
    parseFloat(payment.amount.toString()) + parseFloat(payment.tipAmount?.toString() || '0')
  const after = recomputeEconomics({ amount, transactionType, venuePricing, providerCost })
  return { transactionType, after }
}
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** — `git commit -am "feat(rate-correction): single-payment recompute"`

---

## Task 5: Preview (dry-run aggregate, no writes)

**Files:**

- Modify: `avoqado-server/src/services/superadmin/rateCorrection/rateCorrectionPreview.ts`
- Test: `avoqado-server/tests/unit/services/superadmin/rateCorrection/preview.test.ts`

**Behavior:** `previewRateCorrection({ venueId, accountType, newRates, dateFrom?, dateTo?, missingCostMode })` →

1. `resolveMerchantAccountId` + `buildScopeWhere`.
2. Load in-scope payments (select only fields needed).
3. Find the active provider cost structure (for impact + CREATE_COST feasibility).
4. For each payment: recompute with **newRates** (the corrected venue pricing) → accumulate `afterFee`. Read existing `Payment.feeAmount` → accumulate `beforeFee`. Count `withCost` / `missingCost` from whether a `TransactionCost` exists.
5. Return `{ inScopeCount, withCostCount, missingCostCount, beforeFeeTotal, afterFeeTotal, estimatedImpact: after-before, negativeMarginCount, costStructureAvailable }`.

- [ ] **Step 1: Failing test** (mock prisma `payment.findMany`, `transactionCost.findMany`, `providerCostStructure.findFirst`, and `venuePaymentConfig.findUnique`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentMethod, CardBrand } from '@prisma/client'

vi.mock('../../../../../src/utils/prismaClient', () => ({
  default: {
    venuePaymentConfig: { findUnique: vi.fn().mockResolvedValue({ primaryAccountId: 'ma_1' }) },
    payment: { findMany: vi.fn() },
    transactionCost: { findMany: vi.fn() },
    providerCostStructure: { findFirst: vi.fn() },
  },
}))
import prisma from '../../../../../src/utils/prismaClient'
import { previewRateCorrection } from '../../../../../src/services/superadmin/rateCorrection/rateCorrectionPreview'

const newRates = {
  debitRate: 0.02,
  creditRate: 0.055,
  amexRate: 0.04,
  internationalRate: 0.045,
  includesTax: true,
  taxRate: 0.16,
  fixedFeePerTransaction: 0,
}

describe('previewRateCorrection', () => {
  beforeEach(() => vi.clearAllMocks())
  it('aggregates counts and impact without writing', async () => {
    ;(prisma.payment.findMany as any).mockResolvedValue([
      {
        id: 'p1',
        amount: '1000',
        tipAmount: '0',
        method: PaymentMethod.CREDIT_CARD,
        cardBrand: CardBrand.VISA,
        processorData: null,
        feeAmount: '10',
      }, // before fee 10 → after 55
      {
        id: 'p2',
        amount: '1000',
        tipAmount: '0',
        method: PaymentMethod.CREDIT_CARD,
        cardBrand: CardBrand.VISA,
        processorData: null,
        feeAmount: '10',
      },
    ])
    ;(prisma.transactionCost.findMany as any).mockResolvedValue([{ paymentId: 'p1' }]) // p1 has cost, p2 missing
    ;(prisma.providerCostStructure.findFirst as any).mockResolvedValue({
      debitRate: 0.01,
      creditRate: 0.02,
      amexRate: 0.025,
      internationalRate: 0.03,
      includesTax: true,
      taxRate: 0.16,
      fixedCostPerTransaction: 0,
    })

    const r = await previewRateCorrection({
      venueId: 'v1',
      accountType: 'PRIMARY',
      newRates,
      missingCostMode: 'CREATE_COST',
    })

    expect(r.inScopeCount).toBe(2)
    expect(r.withCostCount).toBe(1)
    expect(r.missingCostCount).toBe(1)
    expect(r.beforeFeeTotal).toBeCloseTo(20, 6)
    expect(r.afterFeeTotal).toBeCloseTo(110, 6) // 55 + 55
    expect(r.estimatedImpact).toBeCloseTo(90, 6)
    expect(r.negativeMarginCount).toBe(0)
    expect(r.costStructureAvailable).toBe(true)
  })

  it('flags costStructureAvailable=false when no provider cost structure', async () => {
    ;(prisma.payment.findMany as any).mockResolvedValue([])
    ;(prisma.transactionCost.findMany as any).mockResolvedValue([])
    ;(prisma.providerCostStructure.findFirst as any).mockResolvedValue(null)
    const r = await previewRateCorrection({
      venueId: 'v1',
      accountType: 'PRIMARY',
      newRates,
      missingCostMode: 'CREATE_COST',
    })
    expect(r.costStructureAvailable).toBe(false)
    expect(r.inScopeCount).toBe(0)
  })
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `previewRateCorrection` (append to `rateCorrectionPreview.ts`):**

```ts
import { AccountType } from '@prisma/client'
import prisma from '../../../utils/prismaClient'
import { resolveMerchantAccountId, buildScopeWhere } from './rateCorrectionScope'

export interface PreviewArgs {
  venueId: string
  accountType: AccountType
  newRates: RateStructureLike
  dateFrom?: Date
  dateTo?: Date
  missingCostMode: 'FIX_PAYMENT_ONLY' | 'CREATE_COST'
}
export interface PreviewResult {
  merchantAccountId: string
  inScopeCount: number
  withCostCount: number
  missingCostCount: number
  beforeFeeTotal: number
  afterFeeTotal: number
  estimatedImpact: number
  negativeMarginCount: number
  costStructureAvailable: boolean
}

export async function previewRateCorrection(args: PreviewArgs): Promise<PreviewResult> {
  const merchantAccountId = await resolveMerchantAccountId(args.venueId, args.accountType)
  const where = buildScopeWhere({
    venueId: args.venueId,
    merchantAccountId,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
  })

  const [payments, providerCost] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        amount: true,
        tipAmount: true,
        method: true,
        cardBrand: true,
        processorData: true,
        feeAmount: true,
      },
    }),
    prisma.providerCostStructure.findFirst({
      where: { merchantAccountId, active: true },
      orderBy: { effectiveFrom: 'desc' },
    }),
  ])

  const costPaymentIds = new Set(
    (
      await prisma.transactionCost.findMany({
        where: { paymentId: { in: payments.map((p) => p.id) } },
        select: { paymentId: true },
      })
    ).map((c) => c.paymentId),
  )

  let beforeFeeTotal = 0,
    afterFeeTotal = 0,
    missingCostCount = 0,
    negativeMarginCount = 0
  for (const p of payments) {
    const { after } = recomputePaymentEconomics(
      p,
      args.newRates,
      providerCost as RateStructureLike | null,
    )
    beforeFeeTotal += parseFloat(p.feeAmount.toString())
    afterFeeTotal += after.feeAmount
    if (!costPaymentIds.has(p.id)) missingCostCount++
    if (after.grossProfit < 0) negativeMarginCount++
  }

  return {
    merchantAccountId,
    inScopeCount: payments.length,
    withCostCount: payments.length - missingCostCount,
    missingCostCount,
    beforeFeeTotal,
    afterFeeTotal,
    estimatedImpact: afterFeeTotal - beforeFeeTotal,
    negativeMarginCount,
    costStructureAvailable: !!providerCost,
  }
}
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** — `git commit -am "feat(rate-correction): preview (dry-run aggregate)"`

---

## Task 6: Apply (write 3 tables + entries + batch + ActivityLog, transactional)

**Files:**

- Create: `avoqado-server/src/services/superadmin/rateCorrection/rateCorrectionApply.ts`
- Test: `avoqado-server/tests/unit/services/superadmin/rateCorrection/apply.test.ts`

**Behavior:** `applyRateCorrection(args, { staffId })`:

1. Re-run preview to get scope + counts; **guard:** throw `BadRequestError` if `inScopeCount > 200` (background-job path is a follow-up; see note). Throw if `missingCostMode === 'CREATE_COST'` but `!costStructureAvailable`.
2. **Update the active `VenuePricingStructure`** for `(venueId, accountType)` with `newRates` (config/forward correctness) — reuse `updateVenuePricingStructure` from `venuePricing.service`.
3. Create the `RateCorrectionBatch` (`status: PENDING`, snapshots `oldRates`/`newRates`).
4. In a single `prisma.$transaction`, for each in-scope payment: read its current `Payment` + `VenueTransaction` + `TransactionCost`; compute `after`; write `RateCorrectionEntry` (before/after); update `Payment` (`feePercentage = after.venueRate`, `feeAmount`, `netAmount`), `VenueTransaction` (`feeAmount`, `netAmount`, `netSettlementAmount`) if it exists; update-or-(create if CREATE_COST) `TransactionCost`.
5. Mark batch `APPLIED` with `paymentCount`, `costCreatedCount`, `estimatedImpact`, `appliedById`, `appliedAt`. On error → `status: FAILED`, `failureReason`, rethrow (the `$transaction` rolls back the row writes; the batch row is updated outside the tx to record the failure).
6. `await logAction({ staffId, venueId, action: 'RATE_CORRECTION_APPLIED', entity: 'RateCorrectionBatch', entityId: batch.id, data: { ...snapshot, paymentCount, estimatedImpact } })`.
7. Return the batch.

> **200-row guard rationale:** prod's biggest single-venue missing-cost scope is ~178; nearly all real cases fit synchronously. The background-job variant (BullMQ/existing job runner) is intentionally deferred to a follow-up task to keep this plan shippable and testable. The guard makes the limit explicit instead of silently timing out.

- [ ] **Step 1: Failing test** — mock prisma (`$transaction` runs the callback with a tx stub), `updateVenuePricingStructure`, and `logAction`. Assert: batch created → APPLIED; Payment/VenueTransaction/TransactionCost updates called with recomputed values; entry stores before-values; `logAction` called; CREATE_COST creates a TransactionCost for the missing one; >200 throws.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentMethod, CardBrand } from '@prisma/client'

const tx = {
  payment: { update: vi.fn() },
  venueTransaction: { update: vi.fn(), findUnique: vi.fn() },
  transactionCost: { update: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  rateCorrectionEntry: { create: vi.fn() },
}
vi.mock('../../../../../src/utils/prismaClient', () => ({
  default: {
    venuePaymentConfig: { findUnique: vi.fn().mockResolvedValue({ primaryAccountId: 'ma_1' }) },
    payment: { findMany: vi.fn() },
    transactionCost: { findMany: vi.fn() },
    providerCostStructure: { findFirst: vi.fn() },
    rateCorrectionBatch: { create: vi.fn().mockResolvedValue({ id: 'b1' }), update: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  },
}))
vi.mock('../../../../../src/services/superadmin/venuePricing.service', () => ({
  updateVenuePricingStructure: vi.fn(),
}))
vi.mock('../../../../../src/services/dashboard/activity-log.service', () => ({
  logAction: vi.fn(),
}))

import prisma from '../../../../../src/utils/prismaClient'
import { logAction } from '../../../../../src/services/dashboard/activity-log.service'
import { applyRateCorrection } from '../../../../../src/services/superadmin/rateCorrection/rateCorrectionApply'

const newRates = {
  debitRate: 0.02,
  creditRate: 0.055,
  amexRate: 0.04,
  internationalRate: 0.045,
  includesTax: true,
  taxRate: 0.16,
  fixedFeePerTransaction: 0,
}

describe('applyRateCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.providerCostStructure.findFirst as any).mockResolvedValue({
      id: 'pcs_1',
      debitRate: 0.01,
      creditRate: 0.02,
      amexRate: 0.025,
      internationalRate: 0.03,
      includesTax: true,
      taxRate: 0.16,
      fixedCostPerTransaction: 0,
    })
    ;(prisma.payment.findMany as any).mockResolvedValue([
      {
        id: 'p1',
        amount: '1000',
        tipAmount: '0',
        method: PaymentMethod.CREDIT_CARD,
        cardBrand: CardBrand.VISA,
        processorData: null,
        feeAmount: '10',
        netAmount: '990',
        feePercentage: '0.01',
      },
    ])
    ;(prisma.transactionCost.findMany as any).mockResolvedValue([{ paymentId: 'p1' }])
    tx.venueTransaction.findUnique.mockResolvedValue({
      id: 'vt1',
      feeAmount: '10',
      netAmount: '990',
      netSettlementAmount: '990',
    })
    tx.transactionCost.findUnique.mockResolvedValue({
      id: 'tc1',
      paymentId: 'p1',
      venueRate: '0.01',
    })
  })

  it('applies, writes 3 tables, records entry, logs, marks APPLIED', async () => {
    const batch = await applyRateCorrection(
      { venueId: 'v1', accountType: 'PRIMARY', newRates, missingCostMode: 'FIX_PAYMENT_ONLY' },
      { staffId: 's1' },
    )
    expect(prisma.rateCorrectionBatch.create).toHaveBeenCalled()
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({
          feeAmount: expect.any(Number),
          netAmount: expect.any(Number),
          feePercentage: expect.any(Number),
        }),
      }),
    )
    expect(tx.venueTransaction.update).toHaveBeenCalled()
    expect(tx.transactionCost.update).toHaveBeenCalled()
    expect(tx.rateCorrectionEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ beforeFeeAmount: 10, afterFeeAmount: 55 }),
      }),
    )
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RATE_CORRECTION_APPLIED', entityId: 'b1' }),
    )
    expect(prisma.rateCorrectionBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPLIED' }) }),
    )
    expect(batch).toBeDefined()
  })

  it('rejects scopes over 200 payments', async () => {
    ;(prisma.payment.findMany as any).mockResolvedValue(
      Array.from({ length: 201 }, (_, i) => ({
        id: `p${i}`,
        amount: '1',
        tipAmount: '0',
        method: PaymentMethod.CREDIT_CARD,
        cardBrand: CardBrand.VISA,
        processorData: null,
        feeAmount: '0',
        netAmount: '1',
        feePercentage: '0',
      })),
    )
    ;(prisma.transactionCost.findMany as any).mockResolvedValue([])
    await expect(
      applyRateCorrection(
        { venueId: 'v1', accountType: 'PRIMARY', newRates, missingCostMode: 'FIX_PAYMENT_ONLY' },
        { staffId: 's1' },
      ),
    ).rejects.toThrow(/200/)
  })

  it('rejects CREATE_COST when no provider cost structure', async () => {
    ;(prisma.providerCostStructure.findFirst as any).mockResolvedValue(null)
    await expect(
      applyRateCorrection(
        { venueId: 'v1', accountType: 'PRIMARY', newRates, missingCostMode: 'CREATE_COST' },
        { staffId: 's1' },
      ),
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `rateCorrectionApply.ts`:**

```ts
import { AccountType } from '@prisma/client'
import prisma from '../../../utils/prismaClient'
import { BadRequestError } from '../../../errors/AppError'
import { logAction } from '../../dashboard/activity-log.service'
import { updateVenuePricingStructure, getActivePricingStructure } from '../venuePricing.service'
import {
  previewRateCorrection,
  recomputePaymentEconomics,
  PreviewArgs,
} from './rateCorrectionPreview'
import { buildScopeWhere } from './rateCorrectionScope'
import { RateStructureLike } from './rateRecompute'

const MAX_SYNC_PAYMENTS = 200

export interface ApplyArgs extends PreviewArgs {}

export async function applyRateCorrection(args: ApplyArgs, ctx: { staffId: string | null }) {
  const preview = await previewRateCorrection(args)
  if (preview.inScopeCount > MAX_SYNC_PAYMENTS) {
    throw new BadRequestError(
      `Scope has ${preview.inScopeCount} payments (> ${MAX_SYNC_PAYMENTS}). Background processing not yet available; narrow the date range.`,
    )
  }
  if (args.missingCostMode === 'CREATE_COST' && !preview.costStructureAvailable) {
    throw new BadRequestError(
      'Cannot create TransactionCost rows: this venue/account has no active provider cost structure.',
    )
  }

  const merchantAccountId = preview.merchantAccountId
  const activePricing = await getActivePricingStructure(args.venueId, args.accountType)
  const oldRates = activePricing
    ? {
        debitRate: activePricing.debitRate,
        creditRate: activePricing.creditRate,
        amexRate: activePricing.amexRate,
        internationalRate: activePricing.internationalRate,
        includesTax: activePricing.includesTax,
        taxRate: activePricing.taxRate,
        fixedFeePerTransaction: activePricing.fixedFeePerTransaction,
      }
    : null

  // 1. Forward correctness: update the active pricing structure to newRates.
  if (activePricing) {
    await updateVenuePricingStructure(activePricing.id, {
      debitRate: Number(args.newRates.debitRate),
      creditRate: Number(args.newRates.creditRate),
      amexRate: Number(args.newRates.amexRate),
      internationalRate: Number(args.newRates.internationalRate),
      includesTax: args.newRates.includesTax ?? undefined,
      fixedFeePerTransaction:
        args.newRates.fixedFeePerTransaction != null
          ? Number(args.newRates.fixedFeePerTransaction)
          : undefined,
    } as any)
  }

  // 2. Batch row (PENDING).
  const batch = await prisma.rateCorrectionBatch.create({
    data: {
      venueId: args.venueId,
      merchantAccountId,
      accountType: args.accountType,
      oldRates: oldRates as any,
      newRates: args.newRates as any,
      dateFrom: args.dateFrom ?? null,
      dateTo: args.dateTo ?? null,
      missingCostMode: args.missingCostMode,
      status: 'PENDING',
    },
  })

  try {
    const where = buildScopeWhere({
      venueId: args.venueId,
      merchantAccountId,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    })
    const payments = await prisma.payment.findMany({
      where,
      select: {
        id: true,
        amount: true,
        tipAmount: true,
        method: true,
        cardBrand: true,
        processorData: true,
        feeAmount: true,
        netAmount: true,
        feePercentage: true,
      },
    })
    const providerCost = await prisma.providerCostStructure.findFirst({
      where: { merchantAccountId, active: true },
      orderBy: { effectiveFrom: 'desc' },
    })

    let costCreatedCount = 0
    let estimatedImpact = 0

    await prisma.$transaction(async (tx) => {
      for (const p of payments) {
        const { transactionType, after } = recomputePaymentEconomics(
          p,
          args.newRates,
          providerCost as RateStructureLike | null,
        )
        const beforeFee = parseFloat(p.feeAmount.toString())
        estimatedImpact += after.feeAmount - beforeFee

        const existingCost = await tx.transactionCost.findUnique({ where: { paymentId: p.id } })
        const existingVt = await tx.venueTransaction.findUnique({ where: { paymentId: p.id } })

        await tx.rateCorrectionEntry.create({
          data: {
            batchId: batch.id,
            paymentId: p.id,
            beforeFeeAmount: beforeFee,
            beforeNetAmount: parseFloat(p.netAmount.toString()),
            beforeFeePercentage: parseFloat(p.feePercentage.toString()),
            beforeVenueTxnFee: existingVt ? parseFloat(existingVt.feeAmount.toString()) : null,
            beforeVenueTxnNet: existingVt ? parseFloat(existingVt.netAmount.toString()) : null,
            beforeVenueTxnNetSettlement:
              existingVt?.netSettlementAmount != null
                ? parseFloat(existingVt.netSettlementAmount.toString())
                : null,
            costCreated: !existingCost && args.missingCostMode === 'CREATE_COST',
            beforeCostJson: existingCost ? (existingCost as any) : undefined,
            afterFeeAmount: after.feeAmount,
            afterNetAmount: after.netAmount,
            afterFeePercentage: after.venueRate,
          },
        })

        await tx.payment.update({
          where: { id: p.id },
          data: {
            feeAmount: after.feeAmount,
            netAmount: after.netAmount,
            feePercentage: after.venueRate,
          },
        })
        if (existingVt) {
          await tx.venueTransaction.update({
            where: { paymentId: p.id },
            data: {
              feeAmount: after.feeAmount,
              netAmount: after.netAmount,
              netSettlementAmount: after.netAmount,
            },
          })
        }

        if (existingCost) {
          await tx.transactionCost.update({
            where: { paymentId: p.id },
            data: {
              venueRate: after.venueRate,
              venueChargeAmount: after.venueChargeAmount,
              venueFixedFee: after.venueFixedFee,
              providerRate: after.providerRate,
              providerCostAmount: after.providerCostAmount,
              providerFixedFee: after.providerFixedFee,
              grossProfit: after.grossProfit,
              profitMargin: after.profitMargin,
            },
          })
        } else if (args.missingCostMode === 'CREATE_COST') {
          await tx.transactionCost.create({
            data: {
              paymentId: p.id,
              merchantAccountId,
              transactionType,
              amount: parseFloat(p.amount.toString()) + parseFloat(p.tipAmount?.toString() || '0'),
              venueRate: after.venueRate,
              venueChargeAmount: after.venueChargeAmount,
              venueFixedFee: after.venueFixedFee,
              providerRate: after.providerRate,
              providerCostAmount: after.providerCostAmount,
              providerFixedFee: after.providerFixedFee,
              grossProfit: after.grossProfit,
              profitMargin: after.profitMargin,
              providerCostStructureId: providerCost?.id,
              venuePricingStructureId: activePricing?.id,
            },
          })
          costCreatedCount++
        }
      }
    })

    const applied = await prisma.rateCorrectionBatch.update({
      where: { id: batch.id },
      data: {
        status: 'APPLIED',
        paymentCount: payments.length,
        costCreatedCount,
        estimatedImpact,
        appliedById: ctx.staffId,
        appliedAt: new Date(),
      },
    })

    await logAction({
      staffId: ctx.staffId,
      venueId: args.venueId,
      action: 'RATE_CORRECTION_APPLIED',
      entity: 'RateCorrectionBatch',
      entityId: batch.id,
      data: {
        merchantAccountId,
        accountType: args.accountType,
        oldRates,
        newRates: args.newRates,
        paymentCount: payments.length,
        costCreatedCount,
        estimatedImpact,
      } as any,
    })

    return applied
  } catch (err) {
    await prisma.rateCorrectionBatch.update({
      where: { id: batch.id },
      data: {
        status: 'FAILED',
        failureReason: err instanceof Error ? err.message : 'Unknown error',
      },
    })
    throw err
  }
}
```

> Verify `updateVenuePricingStructure`'s accepted field names against `venuePricing.service.ts:750` before wiring (Step 3) — adjust the `data` keys if they differ. Reuse is read/forward-only (it creates/updates a structure), safe for legacy.

- [ ] **Step 4: Run → PASS. Step 5: Commit** — `git commit -am "feat(rate-correction): apply (3-table write + entries + audit)"`

---

## Task 7: Reverse (restore before-values)

**Files:**

- Create: `avoqado-server/src/services/superadmin/rateCorrection/rateCorrectionReverse.ts`
- Test: `avoqado-server/tests/unit/services/superadmin/rateCorrection/reverse.test.ts`

**Behavior:** `reverseRateCorrection(batchId, { staffId })`:

1. Load batch + entries. Throw if status !== `APPLIED`.
2. In a `$transaction`, per entry: restore `Payment.feeAmount/netAmount/feePercentage` from `before*`; restore `VenueTransaction` if before values present; if `costCreated` → **delete** the TransactionCost; else restore `TransactionCost` from `beforeCostJson`.
3. Mark batch `REVERSED` (`reversedById`, `reversedAt`). `logAction({ action: 'RATE_CORRECTION_REVERSED', ... })`.

- [ ] **Step 1: Failing test** — mock batch (`status: APPLIED`) with one entry (`costCreated: false`, `beforeCostJson` present). Assert Payment.update restores `beforeFeeAmount`; transactionCost.update restores; batch marked REVERSED; logAction called. Second test: entry with `costCreated: true` → `transactionCost.delete` called. Third: non-APPLIED batch throws.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
const tx = {
  payment: { update: vi.fn() },
  venueTransaction: { update: vi.fn() },
  transactionCost: { update: vi.fn(), delete: vi.fn() },
}
vi.mock('../../../../../src/utils/prismaClient', () => ({
  default: {
    rateCorrectionBatch: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  },
}))
vi.mock('../../../../../src/services/dashboard/activity-log.service', () => ({
  logAction: vi.fn(),
}))
import prisma from '../../../../../src/utils/prismaClient'
import { logAction } from '../../../../../src/services/dashboard/activity-log.service'
import { reverseRateCorrection } from '../../../../../src/services/superadmin/rateCorrection/rateCorrectionReverse'

describe('reverseRateCorrection', () => {
  beforeEach(() => vi.clearAllMocks())
  it('restores before-values and marks REVERSED', async () => {
    ;(prisma.rateCorrectionBatch.findUnique as any).mockResolvedValue({
      id: 'b1',
      venueId: 'v1',
      status: 'APPLIED',
      entries: [
        {
          paymentId: 'p1',
          beforeFeeAmount: '10',
          beforeNetAmount: '990',
          beforeFeePercentage: '0.01',
          beforeVenueTxnFee: '10',
          beforeVenueTxnNet: '990',
          beforeVenueTxnNetSettlement: '990',
          costCreated: false,
          beforeCostJson: {
            venueRate: '0.01',
            venueChargeAmount: '10',
            grossProfit: '5',
            profitMargin: '0.5',
            providerRate: '0.005',
            providerCostAmount: '5',
            venueFixedFee: '0',
            providerFixedFee: '0',
          },
        },
      ],
    })
    await reverseRateCorrection('b1', { staffId: 's1' })
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ feeAmount: 10, netAmount: 990 }),
      }),
    )
    expect(tx.transactionCost.update).toHaveBeenCalled()
    expect(tx.transactionCost.delete).not.toHaveBeenCalled()
    expect(prisma.rateCorrectionBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REVERSED' }) }),
    )
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RATE_CORRECTION_REVERSED' }),
    )
  })
  it('deletes cost rows it created', async () => {
    ;(prisma.rateCorrectionBatch.findUnique as any).mockResolvedValue({
      id: 'b1',
      venueId: 'v1',
      status: 'APPLIED',
      entries: [
        {
          paymentId: 'p2',
          beforeFeeAmount: '0',
          beforeNetAmount: '100',
          beforeFeePercentage: '0',
          beforeVenueTxnFee: null,
          beforeVenueTxnNet: null,
          beforeVenueTxnNetSettlement: null,
          costCreated: true,
          beforeCostJson: null,
        },
      ],
    })
    await reverseRateCorrection('b1', { staffId: 's1' })
    expect(tx.transactionCost.delete).toHaveBeenCalledWith({ where: { paymentId: 'p2' } })
  })
  it('throws when batch is not APPLIED', async () => {
    ;(prisma.rateCorrectionBatch.findUnique as any).mockResolvedValue({
      id: 'b1',
      status: 'REVERSED',
      entries: [],
    })
    await expect(reverseRateCorrection('b1', { staffId: 's1' })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `rateCorrectionReverse.ts`:**

```ts
import prisma from '../../../utils/prismaClient'
import { BadRequestError, NotFoundError } from '../../../errors/AppError'
import { logAction } from '../../dashboard/activity-log.service'

export async function reverseRateCorrection(batchId: string, ctx: { staffId: string | null }) {
  const batch = await prisma.rateCorrectionBatch.findUnique({
    where: { id: batchId },
    include: { entries: true },
  })
  if (!batch) throw new NotFoundError(`RateCorrectionBatch ${batchId} not found`)
  if (batch.status !== 'APPLIED')
    throw new BadRequestError(
      `Batch ${batchId} is ${batch.status}; only APPLIED batches can be reversed`,
    )

  await prisma.$transaction(async (tx) => {
    for (const e of batch.entries) {
      await tx.payment.update({
        where: { id: e.paymentId },
        data: {
          feeAmount: Number(e.beforeFeeAmount),
          netAmount: Number(e.beforeNetAmount),
          feePercentage: Number(e.beforeFeePercentage),
        },
      })
      if (e.beforeVenueTxnFee !== null && e.beforeVenueTxnFee !== undefined) {
        await tx.venueTransaction.update({
          where: { paymentId: e.paymentId },
          data: {
            feeAmount: Number(e.beforeVenueTxnFee),
            netAmount: e.beforeVenueTxnNet != null ? Number(e.beforeVenueTxnNet) : undefined,
            netSettlementAmount:
              e.beforeVenueTxnNetSettlement != null
                ? Number(e.beforeVenueTxnNetSettlement)
                : undefined,
          },
        })
      }
      if (e.costCreated) {
        await tx.transactionCost.delete({ where: { paymentId: e.paymentId } })
      } else if (e.beforeCostJson) {
        const c = e.beforeCostJson as any
        await tx.transactionCost.update({
          where: { paymentId: e.paymentId },
          data: {
            venueRate: Number(c.venueRate),
            venueChargeAmount: Number(c.venueChargeAmount),
            venueFixedFee: Number(c.venueFixedFee),
            providerRate: Number(c.providerRate),
            providerCostAmount: Number(c.providerCostAmount),
            providerFixedFee: Number(c.providerFixedFee),
            grossProfit: Number(c.grossProfit),
            profitMargin: Number(c.profitMargin),
          },
        })
      }
    }
  })

  const reversed = await prisma.rateCorrectionBatch.update({
    where: { id: batchId },
    data: { status: 'REVERSED', reversedById: ctx.staffId, reversedAt: new Date() },
  })
  await logAction({
    staffId: ctx.staffId,
    venueId: batch.venueId,
    action: 'RATE_CORRECTION_REVERSED',
    entity: 'RateCorrectionBatch',
    entityId: batchId,
    data: { paymentCount: batch.entries.length } as any,
  })
  return reversed
}
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** — `git commit -am "feat(rate-correction): reverse a batch"`

---

## Task 8: List batches

**Files:**

- Create: `avoqado-server/src/services/superadmin/rateCorrection/rateCorrectionList.ts`
- Test: `avoqado-server/tests/unit/services/superadmin/rateCorrection/list.test.ts`

- [ ] **Step 1: Failing test** — `listRateCorrections({ venueId? })` calls `prisma.rateCorrectionBatch.findMany` with `where` (venueId if given), `orderBy createdAt desc`, includes `merchantAccount` + `appliedBy` (select safe fields). Assert the call shape.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../../../../../src/utils/prismaClient', () => ({
  default: { rateCorrectionBatch: { findMany: vi.fn().mockResolvedValue([]) } },
}))
import prisma from '../../../../../src/utils/prismaClient'
import { listRateCorrections } from '../../../../../src/services/superadmin/rateCorrection/rateCorrectionList'

describe('listRateCorrections', () => {
  beforeEach(() => vi.clearAllMocks())
  it('filters by venueId when provided', async () => {
    await listRateCorrections({ venueId: 'v1' })
    expect(prisma.rateCorrectionBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { venueId: 'v1' }, orderBy: { createdAt: 'desc' } }),
    )
  })
  it('omits where when no venueId', async () => {
    await listRateCorrections({})
    expect(prisma.rateCorrectionBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: { createdAt: 'desc' } }),
    )
  })
})
```

- [ ] **Step 2: Run → FAIL. Step 3: Implement:**

```ts
import prisma from '../../../utils/prismaClient'

export async function listRateCorrections(args: { venueId?: string }) {
  return prisma.rateCorrectionBatch.findMany({
    where: args.venueId ? { venueId: args.venueId } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      merchantAccount: { select: { id: true, displayName: true, alias: true } },
      appliedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })
}
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** — `git commit -am "feat(rate-correction): list batches"`

---

## Task 9: zod schema + controller + routes + mount

**Files:**

- Create: `avoqado-server/src/schemas/superadmin/rateCorrection.schema.ts`
- Create: `avoqado-server/src/controllers/superadmin/rateCorrection.controller.ts`
- Create: `avoqado-server/src/routes/superadmin/rateCorrection.routes.ts`
- Modify: `avoqado-server/src/routes/superadmin.routes.ts`
- Test: `avoqado-server/tests/unit/services/superadmin/rateCorrection/schema.test.ts`

- [ ] **Step 1: zod schema (+ failing test).** `schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rateCorrectionBodySchema } from '../../../../../src/schemas/superadmin/rateCorrection.schema'

describe('rateCorrectionBodySchema', () => {
  it('accepts a valid body', () => {
    const r = rateCorrectionBodySchema.safeParse({
      accountType: 'PRIMARY',
      newRates: {
        debitRate: 0.02,
        creditRate: 0.055,
        amexRate: 0.04,
        internationalRate: 0.045,
        includesTax: true,
      },
      missingCostMode: 'FIX_PAYMENT_ONLY',
    })
    expect(r.success).toBe(true)
  })
  it('rejects an out-of-range rate', () => {
    const r = rateCorrectionBodySchema.safeParse({
      accountType: 'PRIMARY',
      newRates: { debitRate: 2, creditRate: 0.05, amexRate: 0.04, internationalRate: 0.045 },
      missingCostMode: 'FIX_PAYMENT_ONLY',
    })
    expect(r.success).toBe(false)
  })
})
```

Implement `rateCorrection.schema.ts`:

```ts
import { z } from 'zod'

const rate = z.number().min(0).max(1)
export const rateCorrectionBodySchema = z.object({
  accountType: z.enum(['PRIMARY', 'SECONDARY', 'TERTIARY']),
  newRates: z.object({
    debitRate: rate,
    creditRate: rate,
    amexRate: rate,
    internationalRate: rate,
    includesTax: z.boolean().nullable().optional(),
    taxRate: rate.nullable().optional(),
    fixedFeePerTransaction: z.number().min(0).nullable().optional(),
  }),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  missingCostMode: z.enum(['FIX_PAYMENT_ONLY', 'CREATE_COST']),
})
export type RateCorrectionBody = z.infer<typeof rateCorrectionBodySchema>
```

- [ ] **Step 2: Controller** `rateCorrection.controller.ts` — thin handlers mirroring `venuePricing.controller.ts` (use `req.authContext`/`req.staffId` per existing convention — check one existing superadmin controller for how `staffId` is read; reuse that exact accessor):

```ts
import { Request, Response, NextFunction } from 'express'
import { rateCorrectionBodySchema } from '../../schemas/superadmin/rateCorrection.schema'
import { previewRateCorrection } from '../../services/superadmin/rateCorrection/rateCorrectionPreview'
import { applyRateCorrection } from '../../services/superadmin/rateCorrection/rateCorrectionApply'
import { reverseRateCorrection } from '../../services/superadmin/rateCorrection/rateCorrectionReverse'
import { listRateCorrections } from '../../services/superadmin/rateCorrection/rateCorrectionList'

function parseArgs(req: Request) {
  const body = rateCorrectionBodySchema.parse(req.body)
  return {
    venueId: req.params.venueId,
    accountType: body.accountType,
    newRates: body.newRates,
    dateFrom: body.dateFrom ? new Date(body.dateFrom) : undefined,
    dateTo: body.dateTo ? new Date(body.dateTo) : undefined,
    missingCostMode: body.missingCostMode,
  }
}

// staffId accessor — match the project convention found in another superadmin controller
function getStaffId(req: Request): string | null {
  return (req as any).authContext?.staffId ?? (req as any).staffId ?? null
}

export async function preview(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await previewRateCorrection(parseArgs(req) as any))
  } catch (e) {
    next(e)
  }
}
export async function apply(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await applyRateCorrection(parseArgs(req) as any, { staffId: getStaffId(req) }))
  } catch (e) {
    next(e)
  }
}
export async function reverse(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await reverseRateCorrection(req.params.batchId, { staffId: getStaffId(req) }))
  } catch (e) {
    next(e)
  }
}
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listRateCorrections({ venueId: req.query.venueId as string | undefined }))
  } catch (e) {
    next(e)
  }
}
```

- [ ] **Step 3: Routes** `rateCorrection.routes.ts`:

```ts
import { Router } from 'express'
import * as ctrl from '../../controllers/superadmin/rateCorrection.controller'

const router = Router()
// Base path: /api/v1/superadmin/rate-corrections (SUPERADMIN enforced by parent router)
router.get('/', ctrl.list)
router.post('/venues/:venueId/preview', ctrl.preview)
router.post('/venues/:venueId/apply', ctrl.apply)
router.post('/:batchId/reverse', ctrl.reverse)
export default router
```

- [ ] **Step 4: Mount** in `superadmin.routes.ts` — add import with the others and `router.use('/rate-corrections', rateCorrectionRoutes)` next to `/venue-pricing`:

```ts
import rateCorrectionRoutes from './superadmin/rateCorrection.routes'
// ...
router.use('/rate-corrections', rateCorrectionRoutes)
```

- [ ] **Step 5: Run schema test → PASS;** then `npm run build` (server) to typecheck controller/routes wiring. Expected: build succeeds.

- [ ] **Step 6: Commit** — `git commit -am "feat(rate-correction): zod schema + controller + routes mounted under /superadmin/rate-corrections"`

---

## Task 10: Realtime event (frontend cache invalidation)

**Files:**

- Modify: `avoqado-server/src/services/superadmin/rateCorrection/rateCorrectionApply.ts` and `rateCorrectionReverse.ts`

- [ ] **Step 1:** Find the existing Socket.IO emit helper used by other superadmin mutations (grep `emitToSuperadmin` / `io.to(` / `superadmin:` in `src`). Reuse it. After a successful apply, emit `superadmin:rate-correction:applied` with `{ venueId, batchId }`; after reverse, `superadmin:rate-correction:reversed`. Wrap in try/catch — never fail the request on emit error.

```ts
// at end of applyRateCorrection, before `return applied`
try {
  emitSuperadminEvent('superadmin:rate-correction:applied', {
    venueId: args.venueId,
    batchId: batch.id,
  })
} catch {
  /* non-fatal */
}
```

- [ ] **Step 2:** Add a unit test asserting the emit helper is called on success (mock it). **Step 3: Commit** — `git commit -am "feat(rate-correction): emit realtime events for cache invalidation"`

> If no generic superadmin emit helper exists, skip the emit (the frontend can invalidate optimistically on mutation success) and note it for the frontend plan. Do not build new socket infrastructure here.

---

## Task 11: Integration smoke + green gate

**Files:**

- Test: `avoqado-server/tests/unit/services/superadmin/rateCorrection/integration.test.ts` (still mocked prisma; full apply→reverse round-trip on the service layer)

- [ ] **Step 1:** Write an apply→reverse round-trip test: stub one payment with cost, apply (FIX_PAYMENT_ONLY), capture the `tx.payment.update` "after" args, then reverse and assert `tx.payment.update` is called again with the original before-values. (Reuses the mock harness from Tasks 6 & 7.)

- [ ] **Step 2: Run the full suite** — `cd avoqado-server && npm run check` (typecheck + lint + tests). Expected: green.

- [ ] **Step 3: Build** — `npm run build`. Expected: success.

- [ ] **Step 4: Commit** — `git commit -am "test(rate-correction): apply→reverse integration + green gate"`

---

## Manual dev verification (after Task 11, before declaring done — user requested)

1. **Preview (read-only)** against a real dev venue with a wrong rate (use `psql` on the local dev DB to pick a venue + accountType; never prod):
   `POST /api/v1/superadmin/rate-corrections/venues/<venueId>/preview` with `{ accountType, newRates, missingCostMode }`. Confirm counts + `estimatedImpact` look sane.
2. **Apply** on a **dev/test venue clone** (e.g. a copy of a BAE venue). Then `psql`-verify the three tables are consistent:
   ```sql
   SELECT p.id, p."feeAmount", p."netAmount", vt."feeAmount" AS vt_fee, vt."netAmount" AS vt_net, tc."venueRate", tc."grossProfit"
   FROM "Payment" p
   LEFT JOIN "VenueTransaction" vt ON vt."paymentId" = p.id
   LEFT JOIN "TransactionCost" tc ON tc."paymentId" = p.id
   WHERE p."venueId" = '<venueId>' AND p.status='COMPLETED' LIMIT 20;
   ```
   Confirm `p.feeAmount == vt.feeAmount` and `tc.venueRate` equals the new rate (modulo includesTax).
3. **Check the reports** that read these fields reflect the change: earnings endpoint + the liquidación/settlement report for that venue.
4. **Reverse** the batch (`POST /rate-corrections/<batchId>/reverse`) and re-run the SQL — confirm full restore to the original values.
5. **ActivityLog:** `SELECT action, "entityId", "createdAt" FROM "ActivityLog" WHERE action LIKE 'RATE_CORRECTION%' ORDER BY "createdAt" DESC LIMIT 5;`
6. **Never run apply against production from this work** — prod is corrected only by the operator through the UI (frontend plan).

---

## Self-Review (done while writing)

- **Spec coverage:** §3.1 three-table sync → Task 6 writes Payment+VenueTransaction+TransactionCost; §3.2 reuse formula → Task 2 fork + cross-check; §3.3 scope mapping → Task 3; §4.3 missing-cost modes → Tasks 5/6; §5.2 model → Task 1; §5.3 endpoints → Task 9; §5.4 backfill (idempotent/tx/audit) → Task 6; reversal → Task 7; ActivityLog → Tasks 6/7; realtime → Task 10; testing → all + manual section. ✅
- **Deferred (not gaps):** background-job path for > 200 payments (explicit guard in Task 6 + follow-up); per-payment chunking inside one `$transaction` is fine ≤ 200.
- **Placeholder scan:** the two "verify field names against schema/service before wiring" notes (Tasks 3, 6) are genuine integration checks, not unfinished code — the code is complete and the note flags the one thing the engineer must confirm against the live schema. The Task 9 `getStaffId` accessor must be confirmed against an existing superadmin controller.
- **Type consistency:** `RecomputeResult`, `RateStructureLike`, `PreviewArgs`/`ApplyArgs`, `missingCostMode` literals, `RATE_CORRECTION_APPLIED`/`REVERSED` actions consistent across tasks. ✅

````

---

## Addendum (post-review): edit provider AND/OR venue rates

The operator may correct the **provider cost** and/or the **venue pricing** (spec §3.5). This addendum amends Tasks 5, 6, 9. `grossProfit` stays **full margin** (`venueCharge − providerCost`, matching live — spec §3.6); the live path is **not** touched. Aggregator-split-aware earnings is a **separate tracked follow-up** to `earnings.service.ts` (spec §3.6) — **do not** implement it in this plan.

### A1. Args become two optional rate sets (Tasks 5 & 6)

Replace the single `newRates` with `newVenueRates?` + `newProviderRates?` (at least one required). The recompute uses the **effective** structures:
- effective venue pricing = `newVenueRates` if provided, else the current active `VenuePricingStructure` for `(venueId, accountType)`.
- effective provider cost = `newProviderRates` if provided, else the current active `ProviderCostStructure` for `merchantAccountId`.

Amended `PreviewArgs`/`ApplyArgs` (in `rateCorrectionPreview.ts`, replaces the version in Task 5):

```ts
export interface PreviewArgs {
  venueId: string
  accountType: AccountType
  newVenueRates?: RateStructureLike | null
  newProviderRates?: RateStructureLike | null
  dateFrom?: Date
  dateTo?: Date
  missingCostMode: 'FIX_PAYMENT_ONLY' | 'CREATE_COST'
}
````

In `previewRateCorrection`, resolve effective structures before the loop, and recompute with them:

```ts
const activeVenue = await prisma.venuePricingStructure.findFirst({
  where: { venueId: args.venueId, accountType: args.accountType, active: true },
  orderBy: { effectiveFrom: 'desc' },
})
const activeProvider = await prisma.providerCostStructure.findFirst({
  where: { merchantAccountId, active: true },
  orderBy: { effectiveFrom: 'desc' },
})
const effVenue: RateStructureLike | null =
  args.newVenueRates ?? (activeVenue as RateStructureLike | null)
const effProvider: RateStructureLike | null =
  args.newProviderRates ?? (activeProvider as RateStructureLike | null)
// per payment: recomputePaymentEconomics(p, effVenue, effProvider)  // throws/guards if effVenue is null
// costStructureAvailable = !!effProvider
```

> If `effVenue` is null (no venue pricing exists and none provided), the preview returns `inScopeCount` but flags that recompute can't run; the apply rejects with a clear error. The existing tests still hold by passing `newVenueRates` (they become `newVenueRates` instead of `newRates`).

### A2. Apply updates whichever structure changed (Task 6)

In `applyRateCorrection`, before the recompute transaction:

```ts
// Update venue pricing if the operator edited it (forward correctness)
if (args.newVenueRates && activeVenue) {
  await updateVenuePricingStructure(activeVenue.id, {
    debitRate: Number(args.newVenueRates.debitRate),
    creditRate: Number(args.newVenueRates.creditRate),
    amexRate: Number(args.newVenueRates.amexRate),
    internationalRate: Number(args.newVenueRates.internationalRate),
    includesTax: args.newVenueRates.includesTax ?? undefined,
    fixedFeePerTransaction:
      args.newVenueRates.fixedFeePerTransaction != null
        ? Number(args.newVenueRates.fixedFeePerTransaction)
        : undefined,
  } as any)
}
// Update provider cost if the operator edited it. updateProviderCosts (cost-calculation.service.ts:181)
// deactivates the current structure and creates a new active one — reuse it unmodified (forward-safe).
if (args.newProviderRates) {
  await updateProviderCosts(merchantAccountId, {
    debitRate: Number(args.newProviderRates.debitRate),
    creditRate: Number(args.newProviderRates.creditRate),
    amexRate: Number(args.newProviderRates.amexRate),
    internationalRate: Number(args.newProviderRates.internationalRate),
    fixedCostPerTransaction:
      args.newProviderRates.fixedCostPerTransaction != null
        ? Number(args.newProviderRates.fixedCostPerTransaction)
        : undefined,
  })
}
```

Then the recompute loop uses `effVenue`/`effProvider` (resolved as in A1, AFTER the updates so they read the new active structures), and writes `grossProfit = venueChargeAmount + venueFixedFee − providerCostAmount − providerFixedFee` (already what `recomputeEconomics` returns — full margin). The batch's `oldRates`/`newRates` JSON store **both sides**: `{ venue: {...}, provider: {...} }` (old = pre-edit active structures; new = the applied values).

> ⚠️ `updateProviderCosts` (in the **dead-code** `cost-calculation.service.ts`) is still a correct, self-contained writer — verify it imports cleanly and that reusing it has no side effects beyond `ProviderCostStructure`. If it has drifted, inline an equivalent deactivate-and-create in the new service instead. Either way, **do not** modify the live `transactionCost.service.ts`.

### A3. zod schema (Task 9) — both optional, at least one

```ts
import { z } from 'zod'
const rate = z.number().min(0).max(1)
const rateSet = z.object({
  debitRate: rate,
  creditRate: rate,
  amexRate: rate,
  internationalRate: rate,
  includesTax: z.boolean().nullable().optional(),
  taxRate: rate.nullable().optional(),
  fixedFeePerTransaction: z.number().min(0).nullable().optional(),
  fixedCostPerTransaction: z.number().min(0).nullable().optional(),
})
export const rateCorrectionBodySchema = z
  .object({
    accountType: z.enum(['PRIMARY', 'SECONDARY', 'TERTIARY']),
    newVenueRates: rateSet.optional(),
    newProviderRates: rateSet.optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    missingCostMode: z.enum(['FIX_PAYMENT_ONLY', 'CREATE_COST']),
  })
  .refine((b) => b.newVenueRates || b.newProviderRates, {
    message: 'At least one of newVenueRates / newProviderRates is required',
  })
export type RateCorrectionBody = z.infer<typeof rateCorrectionBodySchema>
```

Update the Task 9 schema test (`schema.test.ts`) to send `newVenueRates` and add a case asserting the body is **rejected** when both rate sets are omitted.

### A4. Controller (Task 9) — map both fields

In `parseArgs`, replace `newRates: body.newRates` with:

```ts
newVenueRates: body.newVenueRates ?? null,
newProviderRates: body.newProviderRates ?? null,
```

### A5. Out of scope — do NOT touch

- `earnings.service.ts` (the split-aware change is the tracked follow-up).
- `transactionCost.service.ts` live path.
- Any production data outside the operator-triggered UI flow.
