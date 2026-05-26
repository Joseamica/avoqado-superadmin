# Superadmin "Ganancias" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a superadmin "Ganancias" page that shows how much money Avoqado earns (terminal profit + online platform fees combined), filterable by date range, broken down by venue, merchant account, provider, card type, and online channel.

**Architecture:** New additive backend resource `/api/v1/superadmin/earnings/*` (own service that **reuses** `paymentAnalyticsService` as-is for terminal metrics and **creates** new queries for online fees + full breakdowns). New frontend feature `src/features/earnings/` consuming it. Nothing legacy (`/dashboard/superadmin/*`) is touched. Backend ships first, then frontend (deploy order rule).

**Tech Stack:** Backend — Express + Prisma/PostgreSQL + jest. Frontend — React 18 + Vite + TanStack Query + recharts + Tailwind v4 + Vitest/RTL/MSW.

**Spec:** `docs/superpowers/specs/2026-05-26-superadmin-earnings-design.md`

---

## File Structure

**Backend (`avoqado-server`):**

- Create `src/services/superadmin/earnings.service.ts` — orchestrates reuse + new queries + pure merge helpers
- Create `src/controllers/superadmin/earnings.controller.ts` — 3 thin handlers
- Create `src/routes/superadmin/earnings.routes.ts` — route definitions
- Modify `src/routes/superadmin.routes.ts` — mount `/earnings`
- Create `tests/unit/services/earnings.service.test.ts` — unit tests for pure helpers

**Frontend (`avoqado-superadmin`):**

- Create `src/shared/lib/money.ts` (+ `money.test.ts`) — MXN formatter
- Create `src/features/earnings/types.ts` — response contracts
- Create `src/features/earnings/api.ts` — `/superadmin/earnings/*` wrappers
- Create `src/features/earnings/use-earnings.ts` — TanStack Query hooks
- Create `src/features/earnings/EarningsKpis.tsx` (+ test)
- Create `src/features/earnings/EarningsTrend.tsx` (+ test)
- Create `src/features/earnings/EarningsBreakdown.tsx` (+ test)
- Create `src/features/earnings/EarningsPage.tsx` (+ integration test)
- Modify `src/app/router.tsx` — lazy route `/earnings`
- Modify `src/shared/layouts/AppLayout.tsx` — sidebar nav entry
- Modify `README.md`, `CHANGELOG.md`

---

# PHASE 1 — Backend (`avoqado-server`)

All paths in Phase 1 are relative to `/Users/amieva/Documents/Programming/Avoqado/avoqado-server`.

## Task 1: Pure transform helpers (TDD)

These are the only parts unit-testable without a DB. The SQL itself is verified by `psql` in Task 3.

**Files:**

- Create: `src/services/superadmin/earnings.service.ts`
- Test: `tests/unit/services/earnings.service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/services/earnings.service.test.ts
import {
  centsToMxn,
  mergeByVenue,
  mergeTimeSeries,
} from '../../../src/services/superadmin/earnings.service'

describe('earnings pure helpers', () => {
  describe('centsToMxn', () => {
    it('converts integer cents to MXN', () => {
      expect(centsToMxn(12345)).toBe(123.45)
    })
    it('treats null/undefined as 0', () => {
      expect(centsToMxn(null)).toBe(0)
      expect(centsToMxn(undefined)).toBe(0)
    })
  })

  describe('mergeByVenue', () => {
    it('adds online fees onto the matching terminal venue and sorts by profit desc', () => {
      const terminal = [
        { venueId: 'v1', venueName: 'A', profit: 100, volume: 1000, transactions: 10 },
        { venueId: 'v2', venueName: 'B', profit: 50, volume: 500, transactions: 5 },
      ]
      const online = [{ venueId: 'v1', venueName: 'A', fees: 25, volume: 300, transactions: 3 }]
      const result = mergeByVenue(terminal, online)
      expect(result).toEqual([
        {
          venueId: 'v1',
          venueName: 'A',
          profit: 125,
          terminalProfit: 100,
          onlineFees: 25,
          volume: 1300,
          transactions: 13,
        },
        {
          venueId: 'v2',
          venueName: 'B',
          profit: 50,
          terminalProfit: 50,
          onlineFees: 0,
          volume: 500,
          transactions: 5,
        },
      ])
    })
    it('includes online-only venues (no terminal row)', () => {
      const result = mergeByVenue(
        [],
        [{ venueId: 'v9', venueName: 'Z', fees: 10, volume: 90, transactions: 1 }],
      )
      expect(result).toEqual([
        {
          venueId: 'v9',
          venueName: 'Z',
          profit: 10,
          terminalProfit: 0,
          onlineFees: 10,
          volume: 90,
          transactions: 1,
        },
      ])
    })
  })

  describe('mergeTimeSeries', () => {
    it('merges terminal + online points by date and fills gaps with 0', () => {
      const terminal = [
        { date: '2026-05-01', profit: 100 },
        { date: '2026-05-02', profit: 200 },
      ]
      const online = [
        { date: '2026-05-02', fees: 30 },
        { date: '2026-05-03', fees: 5 },
      ]
      expect(mergeTimeSeries(terminal, online)).toEqual([
        { date: '2026-05-01', terminalProfit: 100, onlineFees: 0, profit: 100 },
        { date: '2026-05-02', terminalProfit: 200, onlineFees: 30, profit: 230 },
        { date: '2026-05-03', terminalProfit: 0, onlineFees: 5, profit: 5 },
      ])
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/services/earnings.service.test.ts`
Expected: FAIL — "Cannot find module '.../earnings.service'".

- [ ] **Step 3: Write the pure helpers (top of new service file)**

```ts
// src/services/superadmin/earnings.service.ts
import prisma from '../../utils/prismaClient'
import logger from '../../config/logger'
import { Prisma } from '@prisma/client'
import * as paymentAnalyticsService from './paymentAnalytics.service'

export interface DateRange {
  startDate?: Date
  endDate?: Date
}

/** EcommerceMerchant stores Avoqado's fee in integer centavos; UI works in MXN. */
export function centsToMxn(cents: number | bigint | null | undefined): number {
  return Number(cents ?? 0) / 100
}

interface TerminalVenueAgg {
  venueId: string
  venueName: string
  profit: number
  volume: number
  transactions: number
}
interface OnlineVenueAgg {
  venueId: string
  venueName: string
  fees: number
  volume: number
  transactions: number
}

export interface VenueEarnings {
  venueId: string
  venueName: string
  profit: number
  terminalProfit: number
  onlineFees: number
  volume: number
  transactions: number
}

/** Combine per-venue terminal profit and online fees into one list, sorted by total profit. */
export function mergeByVenue(
  terminal: TerminalVenueAgg[],
  online: OnlineVenueAgg[],
): VenueEarnings[] {
  const map = new Map<string, VenueEarnings>()
  for (const t of terminal) {
    map.set(t.venueId, {
      venueId: t.venueId,
      venueName: t.venueName,
      terminalProfit: t.profit,
      onlineFees: 0,
      profit: t.profit,
      volume: t.volume,
      transactions: t.transactions,
    })
  }
  for (const o of online) {
    const existing = map.get(o.venueId)
    if (existing) {
      existing.onlineFees += o.fees
      existing.profit += o.fees
      existing.volume += o.volume
      existing.transactions += o.transactions
    } else {
      map.set(o.venueId, {
        venueId: o.venueId,
        venueName: o.venueName,
        terminalProfit: 0,
        onlineFees: o.fees,
        profit: o.fees,
        volume: o.volume,
        transactions: o.transactions,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.profit - a.profit)
}

export interface EarningsTimePoint {
  date: string
  terminalProfit: number
  onlineFees: number
  profit: number
}

/** Merge terminal-profit and online-fee time series by date bucket, filling gaps with 0. */
export function mergeTimeSeries(
  terminal: { date: string; profit: number }[],
  online: { date: string; fees: number }[],
): EarningsTimePoint[] {
  const map = new Map<string, EarningsTimePoint>()
  for (const t of terminal) {
    map.set(t.date, { date: t.date, terminalProfit: t.profit, onlineFees: 0, profit: t.profit })
  }
  for (const o of online) {
    const existing = map.get(o.date)
    if (existing) {
      existing.onlineFees += o.fees
      existing.profit += o.fees
    } else {
      map.set(o.date, { date: o.date, terminalProfit: 0, onlineFees: o.fees, profit: o.fees })
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/services/earnings.service.test.ts`
Expected: PASS (all 6 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/services/superadmin/earnings.service.ts tests/unit/services/earnings.service.test.ts
git commit -m "feat(earnings): add pure transform helpers for superadmin earnings service"
```

---

## Task 2: Summary + time-series queries (service)

**Files:**

- Modify: `src/services/superadmin/earnings.service.ts` (append below the helpers)

- [ ] **Step 1: Add the date-range default + result interfaces**

```ts
// append to src/services/superadmin/earnings.service.ts
export interface EarningsTotals {
  grossProfit: number
  terminalProfit: number
  onlineFees: number
  volume: number
  transactions: number
  averageMargin: number
}
export interface MerchantEarnings {
  merchantAccountId: string
  label: string
  providerCode: string
  profit: number
  volume: number
  transactions: number
}
export interface ProviderEarnings {
  providerId: string
  providerCode: string
  providerName: string
  volume: number
  cost: number
  transactions: number
}
export interface CardTypeEarnings {
  type: string
  transactions: number
  volume: number
  profit: number
  margin: number
}
export interface ChannelEarnings {
  ecommerceMerchantId: string
  label: string
  providerCode: string
  fees: number
  volume: number
  transactions: number
}
export interface EarningsSummary {
  range: { startDate: string; endDate: string }
  totals: EarningsTotals
  byVenue: VenueEarnings[]
  byMerchant: MerchantEarnings[]
  byProvider: ProviderEarnings[]
  byCardType: CardTypeEarnings[]
  byChannel: ChannelEarnings[]
}

function resolveRange(range?: DateRange): { startDate: Date; endDate: Date } {
  const endDate = range?.endDate ?? new Date()
  const startDate = range?.startDate ?? new Date(endDate.getFullYear(), endDate.getMonth(), 1)
  return { startDate, endDate }
}
```

- [ ] **Step 2: Add `getEarningsSummary` (reuse terminal metrics, create online + full breakdowns)**

```ts
// append to src/services/superadmin/earnings.service.ts
export async function getEarningsSummary(range?: DateRange): Promise<EarningsSummary> {
  const { startDate, endDate } = resolveRange(range)
  logger.info('Calculating earnings summary', { startDate, endDate })

  // REUSE (unchanged shared service): terminal totals, card-type + provider breakdowns.
  const terminal = await paymentAnalyticsService.getProfitMetrics({ startDate, endDate })

  // CREATE: full per-venue terminal, per-merchant terminal, and the online (e-commerce) aggregates.
  const [terminalByVenue, merchantRows, onlineByVenue, onlineTotals, channelRows] =
    await Promise.all([
      prisma.$queryRaw<
        Array<{
          venueId: string
          venueName: string
          profit: Prisma.Decimal
          volume: Prisma.Decimal
          transactions: bigint
        }>
      >`
      SELECT v.id as "venueId", v.name as "venueName",
             COALESCE(SUM(tc."grossProfit"), 0) as profit,
             COALESCE(SUM(tc.amount), 0) as volume,
             COUNT(*) as transactions
      FROM "TransactionCost" tc
      JOIN "Payment" p ON tc."paymentId" = p.id
      JOIN "Venue" v ON p."venueId" = v.id
      WHERE tc."createdAt" >= ${startDate} AND tc."createdAt" <= ${endDate}
      GROUP BY v.id, v.name
    `,
      prisma.$queryRaw<
        Array<{
          merchantAccountId: string
          displayName: string | null
          alias: string | null
          externalMerchantId: string
          providerCode: string
          profit: Prisma.Decimal
          volume: Prisma.Decimal
          transactions: bigint
        }>
      >`
      SELECT ma.id as "merchantAccountId", ma."displayName", ma.alias, ma."externalMerchantId",
             pp.code as "providerCode",
             COALESCE(SUM(tc."grossProfit"), 0) as profit,
             COALESCE(SUM(tc.amount), 0) as volume,
             COUNT(*) as transactions
      FROM "TransactionCost" tc
      JOIN "MerchantAccount" ma ON tc."merchantAccountId" = ma.id
      JOIN "PaymentProvider" pp ON ma."providerId" = pp.id
      WHERE tc."createdAt" >= ${startDate} AND tc."createdAt" <= ${endDate}
      GROUP BY ma.id, ma."displayName", ma.alias, ma."externalMerchantId", pp.code
      ORDER BY profit DESC
    `,
      prisma.$queryRaw<
        Array<{
          venueId: string
          venueName: string
          fees: bigint
          volume: Prisma.Decimal
          transactions: bigint
        }>
      >`
      SELECT v.id as "venueId", v.name as "venueName",
             COALESCE(SUM(cs."applicationFeeCents"), 0) as fees,
             COALESCE(SUM(cs.amount), 0) as volume,
             COUNT(*) as transactions
      FROM "CheckoutSession" cs
      JOIN "EcommerceMerchant" em ON cs."ecommerceMerchantId" = em.id
      JOIN "Venue" v ON em."venueId" = v.id
      WHERE cs.status = 'COMPLETED' AND cs."createdAt" >= ${startDate} AND cs."createdAt" <= ${endDate}
      GROUP BY v.id, v.name
    `,
      prisma.checkoutSession.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } },
        _count: true,
        _sum: { amount: true, applicationFeeCents: true },
      }),
      prisma.$queryRaw<
        Array<{
          ecommerceMerchantId: string
          channelName: string | null
          businessName: string | null
          providerCode: string
          fees: bigint
          volume: Prisma.Decimal
          transactions: bigint
        }>
      >`
      SELECT em.id as "ecommerceMerchantId", em."channelName", em."businessName",
             pp.code as "providerCode",
             COALESCE(SUM(cs."applicationFeeCents"), 0) as fees,
             COALESCE(SUM(cs.amount), 0) as volume,
             COUNT(*) as transactions
      FROM "CheckoutSession" cs
      JOIN "EcommerceMerchant" em ON cs."ecommerceMerchantId" = em.id
      JOIN "PaymentProvider" pp ON em."providerId" = pp.id
      WHERE cs.status = 'COMPLETED' AND cs."createdAt" >= ${startDate} AND cs."createdAt" <= ${endDate}
      GROUP BY em.id, em."channelName", em."businessName", pp.code
      ORDER BY fees DESC
    `,
    ])

  const byVenue = mergeByVenue(
    terminalByVenue.map((r) => ({
      venueId: r.venueId,
      venueName: r.venueName,
      profit: Number(r.profit),
      volume: Number(r.volume),
      transactions: Number(r.transactions),
    })),
    onlineByVenue.map((r) => ({
      venueId: r.venueId,
      venueName: r.venueName,
      fees: centsToMxn(r.fees),
      volume: Number(r.volume),
      transactions: Number(r.transactions),
    })),
  )

  const onlineFees = centsToMxn(onlineTotals._sum.applicationFeeCents)
  const onlineVolume = Number(onlineTotals._sum.amount) || 0
  const onlineTransactions = onlineTotals._count

  return {
    range: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    totals: {
      grossProfit: terminal.totalProfit + onlineFees,
      terminalProfit: terminal.totalProfit,
      onlineFees,
      volume: terminal.totalVolume + onlineVolume,
      transactions: terminal.totalTransactions + onlineTransactions,
      averageMargin: terminal.averageMargin,
    },
    byVenue,
    byMerchant: merchantRows.map((r) => ({
      merchantAccountId: r.merchantAccountId,
      label: r.displayName || r.alias || r.externalMerchantId,
      providerCode: r.providerCode,
      profit: Number(r.profit),
      volume: Number(r.volume),
      transactions: Number(r.transactions),
    })),
    byProvider: terminal.topProviders.map((p) => ({
      providerId: p.providerId,
      providerCode: p.providerCode,
      providerName: p.providerName,
      volume: p.volume,
      cost: p.cost,
      transactions: p.transactions,
    })),
    byCardType: terminal.byCardType.map((c) => ({
      type: c.type,
      transactions: c.transactions,
      volume: c.volume,
      profit: c.profit,
      margin: c.margin,
    })),
    byChannel: channelRows.map((r) => ({
      ecommerceMerchantId: r.ecommerceMerchantId,
      label: r.channelName || r.businessName || r.ecommerceMerchantId,
      providerCode: r.providerCode,
      fees: centsToMxn(r.fees),
      volume: Number(r.volume),
      transactions: Number(r.transactions),
    })),
  }
}
```

- [ ] **Step 3: Add `getEarningsTimeSeries` (reuse terminal series + new online series)**

```ts
// append to src/services/superadmin/earnings.service.ts
export async function getEarningsTimeSeries(
  range?: DateRange,
  granularity: 'daily' | 'weekly' | 'monthly' = 'daily',
): Promise<EarningsTimePoint[]> {
  const { startDate, endDate } = resolveRange(range)

  // REUSE: terminal profit series (unchanged shared service).
  const terminalSeries = await paymentAnalyticsService.getProfitTimeSeries(
    { startDate, endDate },
    granularity,
  )

  // CREATE: online fee series (same DATE_TRUNC buckets).
  const truncInterval =
    granularity === 'weekly' ? 'week' : granularity === 'monthly' ? 'month' : 'day'
  const dateFormat = granularity === 'monthly' ? 'YYYY-MM' : 'YYYY-MM-DD'
  const onlineRows = await prisma.$queryRaw<Array<{ date: string; fees: bigint }>>(
    Prisma.sql`
      SELECT TO_CHAR(DATE_TRUNC(${Prisma.raw(`'${truncInterval}'`)}, "createdAt"), ${Prisma.raw(`'${dateFormat}'`)}) as date,
             COALESCE(SUM("applicationFeeCents"), 0) as fees
      FROM "CheckoutSession"
      WHERE status = 'COMPLETED' AND "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
      GROUP BY date
      ORDER BY date
    `,
  )

  return mergeTimeSeries(
    terminalSeries.map((t) => ({ date: t.date, profit: t.profit })),
    onlineRows.map((o) => ({ date: o.date, fees: centsToMxn(o.fees) })),
  )
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `0` errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/superadmin/earnings.service.ts
git commit -m "feat(earnings): add summary + time-series queries (terminal reuse + online)"
```

---

## Task 3: Verify the SQL against the local DB (psql)

**Files:** none (verification only).

- [ ] **Step 1: Confirm terminal vs online buckets do NOT overlap**

Run:

```bash
export DATABASE_URL="postgresql://postgres:exitosoy777@localhost:5432/av-db-25"
psql "$DATABASE_URL" -c 'SELECT COUNT(*) AS overlap FROM "TransactionCost" tc JOIN "Payment" p ON tc."paymentId"=p.id WHERE p."ecommerceMerchantId" IS NOT NULL;'
```

Expected: `overlap = 0` (online payments have no TransactionCost). If non-zero, add `AND p."ecommerceMerchantId" IS NULL` to the terminal queries in Task 2 and re-run Task 2 Step 4. Record the finding.

- [ ] **Step 2: Sanity-check the totals math for the current month**

Run:

```bash
psql "$DATABASE_URL" -c "SELECT COALESCE(SUM(\"grossProfit\"),0) AS terminal_profit FROM \"TransactionCost\" WHERE \"createdAt\" >= date_trunc('month', now());"
psql "$DATABASE_URL" -c "SELECT COALESCE(SUM(\"applicationFeeCents\"),0)/100.0 AS online_fees FROM \"CheckoutSession\" WHERE status='COMPLETED' AND \"createdAt\" >= date_trunc('month', now());"
```

Expected: two numbers; their sum is what `totals.grossProfit` must return for the default range. Note them for Task 5.

- [ ] **Step 3: Commit** — none (no code changed).

---

## Task 4: Controller + route + mount

**Files:**

- Create: `src/controllers/superadmin/earnings.controller.ts`
- Create: `src/routes/superadmin/earnings.routes.ts`
- Modify: `src/routes/superadmin.routes.ts`

- [ ] **Step 1: Write the controller**

```ts
// src/controllers/superadmin/earnings.controller.ts
import { Request, Response, NextFunction } from 'express'
import * as earningsService from '../../services/superadmin/earnings.service'

function parseRange(req: Request) {
  const { startDate, endDate } = req.query
  return {
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
  }
}

/** GET /api/v1/superadmin/earnings/summary */
export async function getEarningsSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await earningsService.getEarningsSummary(parseRange(req))
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

/** GET /api/v1/superadmin/earnings/time-series */
export async function getEarningsTimeSeries(req: Request, res: Response, next: NextFunction) {
  try {
    const granularity = (req.query.granularity as 'daily' | 'weekly' | 'monthly') || 'daily'
    const data = await earningsService.getEarningsTimeSeries(parseRange(req), granularity)
    res.json({ success: true, data, meta: { granularity } })
  } catch (error) {
    next(error)
  }
}
```

- [ ] **Step 2: Write the routes**

```ts
// src/routes/superadmin/earnings.routes.ts
import { Router } from 'express'
import * as earningsController from '../../controllers/superadmin/earnings.controller'

const router = Router()

// Base path: /api/v1/superadmin/earnings  (SUPERADMIN guard inherited from parent router)
router.get('/summary', earningsController.getEarningsSummary)
router.get('/time-series', earningsController.getEarningsTimeSeries)

export default router
```

- [ ] **Step 3: Mount in the superadmin router**

In `src/routes/superadmin.routes.ts`, add the import next to the other sub-route imports:

```ts
import earningsRoutes from './superadmin/earnings.routes'
```

And add the mount next to `router.use('/payment-analytics', paymentAnalyticsRoutes)`:

```ts
router.use('/earnings', earningsRoutes)
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `0` errors.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/superadmin/earnings.controller.ts src/routes/superadmin/earnings.routes.ts src/routes/superadmin.routes.ts
git commit -m "feat(earnings): expose GET /superadmin/earnings/summary + time-series"
```

---

## Task 5: End-to-end API verification

**Files:** none (verification only). The server runs `tsx watch`, so it auto-reloads.

- [ ] **Step 1: Call the endpoint with a superadmin session cookie**

Log in via the superadmin UI (or `! curl` the login) to get the session cookie, then:

```bash
curl -s --cookie "<session-cookie>" "http://localhost:3000/api/v1/superadmin/earnings/summary" | jq '.data.totals'
```

Expected: a `totals` object whose `grossProfit` equals `terminal_profit + online_fees` from Task 3 Step 2 (current month default).

- [ ] **Step 2: Confirm legacy is untouched**

Run: `git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server diff --name-only HEAD~4..HEAD | grep -i dashboard || echo "no dashboard files touched"`
Expected: `no dashboard files touched`.

- [ ] **Step 3: Commit** — none.

---

# PHASE 2 — Frontend (`avoqado-superadmin`)

All paths in Phase 2 are relative to `/Users/amieva/Documents/Programming/Avoqado/avoqado-superadmin`.

## Task 6: `money.ts` formatter (TDD)

**Files:**

- Create: `src/shared/lib/money.ts`
- Test: `src/shared/lib/money.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/lib/money.test.ts
import { describe, it, expect } from 'vitest'
import { formatMoney, formatCompactMoney } from './money'

describe('formatMoney', () => {
  it('formats MXN with 2 decimals and grouping', () => {
    expect(formatMoney(128450.2)).toBe('$128,450.20')
  })
  it('treats null/undefined as 0', () => {
    expect(formatMoney(null)).toBe('$0.00')
  })
})

describe('formatCompactMoney', () => {
  it('abbreviates large amounts', () => {
    expect(formatCompactMoney(4200000)).toBe('$4.2M')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/lib/money.test.ts`
Expected: FAIL — cannot resolve `./money`.

- [ ] **Step 3: Implement**

```ts
// src/shared/lib/money.ts
const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const mxnCompact = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Full MXN amount, e.g. "$128,450.20". Render inside a `tabular-nums` element. */
export function formatMoney(value: number | null | undefined): string {
  return mxn.format(value ?? 0)
}

/** Abbreviated MXN amount for headline KPIs, e.g. "$4.2M". */
export function formatCompactMoney(value: number | null | undefined): string {
  return mxnCompact.format(value ?? 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/lib/money.test.ts`
Expected: PASS. (If `formatCompactMoney` yields a non-breaking space variant, normalize the expectation to the actual ICU output before committing — log the actual value and match it.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/money.ts src/shared/lib/money.test.ts
git commit -m "feat(money): add reusable MXN formatter"
```

---

## Task 7: Earnings response types

**Files:**

- Create: `src/features/earnings/types.ts`

- [ ] **Step 1: Write the contracts (mirror the backend shapes)**

```ts
// src/features/earnings/types.ts
export interface EarningsTotals {
  grossProfit: number
  terminalProfit: number
  onlineFees: number
  volume: number
  transactions: number
  averageMargin: number
}
export interface VenueEarnings {
  venueId: string
  venueName: string
  profit: number
  terminalProfit: number
  onlineFees: number
  volume: number
  transactions: number
}
export interface MerchantEarnings {
  merchantAccountId: string
  label: string
  providerCode: string
  profit: number
  volume: number
  transactions: number
}
export interface ProviderEarnings {
  providerId: string
  providerCode: string
  providerName: string
  volume: number
  cost: number
  transactions: number
}
export interface CardTypeEarnings {
  type: string
  transactions: number
  volume: number
  profit: number
  margin: number
}
export interface ChannelEarnings {
  ecommerceMerchantId: string
  label: string
  providerCode: string
  fees: number
  volume: number
  transactions: number
}
export interface EarningsSummary {
  range: { startDate: string; endDate: string }
  totals: EarningsTotals
  byVenue: VenueEarnings[]
  byMerchant: MerchantEarnings[]
  byProvider: ProviderEarnings[]
  byCardType: CardTypeEarnings[]
  byChannel: ChannelEarnings[]
}
export interface EarningsTimePoint {
  date: string
  terminalProfit: number
  onlineFees: number
  profit: number
}
export type Granularity = 'daily' | 'weekly' | 'monthly'
```

- [ ] **Step 2: Commit**

```bash
git add src/features/earnings/types.ts
git commit -m "feat(earnings): add response type contracts"
```

---

## Task 8: API client wrappers

**Files:**

- Create: `src/features/earnings/api.ts`

- [ ] **Step 1: Write the wrappers (only `/superadmin/*`, never `/dashboard/*`)**

```ts
// src/features/earnings/api.ts
import { api } from '@/shared/lib/api'
import type { EarningsSummary, EarningsTimePoint, Granularity } from './types'

export interface EarningsRangeParams {
  startDate?: string
  endDate?: string
}

export async function fetchEarningsSummary(params: EarningsRangeParams): Promise<EarningsSummary> {
  const { data } = await api.get<{ success: boolean; data: EarningsSummary }>(
    '/superadmin/earnings/summary',
    { params },
  )
  if (!data?.data) throw new Error('Server returned empty response for earnings summary')
  return data.data
}

export async function fetchEarningsTimeSeries(
  params: EarningsRangeParams & { granularity: Granularity },
): Promise<EarningsTimePoint[]> {
  const { data } = await api.get<{ success: boolean; data: EarningsTimePoint[] }>(
    '/superadmin/earnings/time-series',
    {
      params,
    },
  )
  return Array.isArray(data?.data) ? data.data : []
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/earnings/api.ts
git commit -m "feat(earnings): add /superadmin/earnings api client"
```

---

## Task 9: TanStack Query hooks

**Files:**

- Create: `src/features/earnings/use-earnings.ts`

- [ ] **Step 1: Write the hooks**

```ts
// src/features/earnings/use-earnings.ts
import { useQuery } from '@tanstack/react-query'
import { fetchEarningsSummary, fetchEarningsTimeSeries, type EarningsRangeParams } from './api'
import type { Granularity } from './types'

export function useEarningsSummary(range: EarningsRangeParams) {
  return useQuery({
    queryKey: ['superadmin', 'earnings', 'summary', range.startDate, range.endDate],
    queryFn: () => fetchEarningsSummary(range),
  })
}

export function useEarningsTimeSeries(range: EarningsRangeParams, granularity: Granularity) {
  return useQuery({
    queryKey: [
      'superadmin',
      'earnings',
      'time-series',
      range.startDate,
      range.endDate,
      granularity,
    ],
    queryFn: () => fetchEarningsTimeSeries({ ...range, granularity }),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/earnings/use-earnings.ts
git commit -m "feat(earnings): add query hooks for summary + time-series"
```

---

## Task 10: `EarningsKpis` component (TDD)

**Files:**

- Create: `src/features/earnings/EarningsKpis.tsx`
- Test: `src/features/earnings/EarningsKpis.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/earnings/EarningsKpis.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EarningsKpis } from './EarningsKpis'
import type { EarningsTotals } from './types'

const totals: EarningsTotals = {
  grossProfit: 128450.2,
  terminalProfit: 119800,
  onlineFees: 8650.2,
  volume: 4200000,
  transactions: 18204,
  averageMargin: 0.0306,
}

describe('EarningsKpis', () => {
  it('shows total profit and the terminal/online split', () => {
    render(<EarningsKpis totals={totals} />)
    expect(screen.getByText('$128,450.20')).toBeInTheDocument()
    expect(screen.getByText(/Terminales/)).toBeInTheDocument()
    expect(screen.getByText(/En línea/)).toBeInTheDocument()
    expect(screen.getByText('3.06%')).toBeInTheDocument()
    expect(screen.getByText('18,204')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/earnings/EarningsKpis.test.tsx`
Expected: FAIL — cannot resolve `./EarningsKpis`.

- [ ] **Step 3: Implement**

```tsx
// src/features/earnings/EarningsKpis.tsx
import { formatMoney } from '@/shared/lib/money'
import type { EarningsTotals } from './types'

const intFmt = new Intl.NumberFormat('es-MX')

function Kpi({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow text-[var(--ink-faint)]">{label}</span>
      <span className="text-[22px] font-semibold tabular-nums text-[var(--ink)]">{value}</span>
      {sub ? <span className="text-[12px] tabular-nums text-[var(--ink-muted)]">{sub}</span> : null}
    </div>
  )
}

export function EarningsKpis({ totals }: { totals: EarningsTotals }) {
  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
      <Kpi
        label="Ganancia bruta"
        value={formatMoney(totals.grossProfit)}
        sub={
          <>
            Terminales {formatMoney(totals.terminalProfit)} · En línea{' '}
            {formatMoney(totals.onlineFees)}
          </>
        }
      />
      <Kpi label="Volumen procesado" value={formatMoney(totals.volume)} />
      <Kpi
        label="Margen promedio"
        value={`${(totals.averageMargin * 100).toFixed(2)}%`}
        sub="Sólo terminales"
      />
      <Kpi label="Transacciones" value={intFmt.format(totals.transactions)} />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/earnings/EarningsKpis.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/earnings/EarningsKpis.tsx src/features/earnings/EarningsKpis.test.tsx
git commit -m "feat(earnings): add KPI row with terminal/online split"
```

---

## Task 11: `EarningsTrend` component (recharts)

**Files:**

- Create: `src/features/earnings/EarningsTrend.tsx`
- Test: `src/features/earnings/EarningsTrend.test.tsx`

- [ ] **Step 1: Write the failing test** (recharts needs a sized container; assert the granularity toggle renders, not the SVG)

```tsx
// src/features/earnings/EarningsTrend.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EarningsTrend } from './EarningsTrend'

const data = [
  { date: '2026-05-01', terminalProfit: 100, onlineFees: 10, profit: 110 },
  { date: '2026-05-02', terminalProfit: 200, onlineFees: 0, profit: 200 },
]

describe('EarningsTrend', () => {
  it('renders the granularity toggle and calls back on change', () => {
    const onGranularityChange = vi.fn()
    render(
      <EarningsTrend data={data} granularity="daily" onGranularityChange={onGranularityChange} />,
    )
    expect(screen.getByRole('button', { name: 'Día' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
    expect(onGranularityChange).toHaveBeenCalledWith('weekly')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/earnings/EarningsTrend.test.tsx`
Expected: FAIL — cannot resolve `./EarningsTrend`.

- [ ] **Step 3: Implement** (GitHub-dark palette via CSS vars; neutral accent, no gradient)

```tsx
// src/features/earnings/EarningsTrend.tsx
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/shared/ui/Button'
import { formatMoney, formatCompactMoney } from '@/shared/lib/money'
import type { EarningsTimePoint, Granularity } from './types'

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'daily', label: 'Día' },
  { value: 'weekly', label: 'Semana' },
  { value: 'monthly', label: 'Mes' },
]

export function EarningsTrend({
  data,
  granularity,
  onGranularityChange,
}: {
  data: EarningsTimePoint[]
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
}) {
  return (
    <section className="rounded-[10px] border border-[var(--line)] p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-[var(--ink)]">Tendencia</h2>
        <div className="flex gap-1">
          {OPTIONS.map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant={o.value === granularity ? 'secondary' : 'ghost'}
              onClick={() => onGranularityChange(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </header>
      {data.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[var(--ink-faint)]">
          No hubo transacciones en este rango. Prueba ampliar las fechas.
        </p>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--ink-faint)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCompactMoney(Number(v))}
                tick={{ fontSize: 11, fill: 'var(--ink-faint)' }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                formatter={(v: number) => formatMoney(v)}
                contentStyle={{
                  background: 'var(--canvas-raised)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="var(--ink)"
                fill="var(--canvas-raised)"
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/earnings/EarningsTrend.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/earnings/EarningsTrend.tsx src/features/earnings/EarningsTrend.test.tsx
git commit -m "feat(earnings): add recharts trend with granularity toggle"
```

---

## Task 12: `EarningsBreakdown` component (DataTable tabs)

**Files:**

- Create: `src/features/earnings/EarningsBreakdown.tsx`
- Test: `src/features/earnings/EarningsBreakdown.test.tsx`

- [ ] **Step 1: Confirm the DataTable column API**

Run: `sed -n '1,60p' src/shared/data-table/DataTable.tsx`
Expected: note the column/prop shape (e.g. `columns`, `data`, accessor + header). Match the existing usage in `src/features/merchants/` or `src/features/venues/` (open one list page that uses `DataTable` and mirror its column definitions). Use that exact API in Step 3.

- [ ] **Step 2: Write the failing test**

```tsx
// src/features/earnings/EarningsBreakdown.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EarningsBreakdown } from './EarningsBreakdown'
import type { EarningsSummary } from './types'

const summary: EarningsSummary = {
  range: { startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-31T00:00:00.000Z' },
  totals: {
    grossProfit: 0,
    terminalProfit: 0,
    onlineFees: 0,
    volume: 0,
    transactions: 0,
    averageMargin: 0,
  },
  byVenue: [
    {
      venueId: 'v1',
      venueName: 'Amaena',
      profit: 36400,
      terminalProfit: 36000,
      onlineFees: 400,
      volume: 1200000,
      transactions: 5120,
    },
  ],
  byMerchant: [
    {
      merchantAccountId: 'm1',
      label: 'Cuenta Principal',
      providerCode: 'MENTA',
      profit: 100,
      volume: 1000,
      transactions: 10,
    },
  ],
  byProvider: [
    {
      providerId: 'p1',
      providerCode: 'MENTA',
      providerName: 'Menta',
      volume: 1000,
      cost: 30,
      transactions: 10,
    },
  ],
  byCardType: [{ type: 'CREDIT', transactions: 10, volume: 1000, profit: 30, margin: 0.03 }],
  byChannel: [
    {
      ecommerceMerchantId: 'e1',
      label: 'Amaena online',
      providerCode: 'STRIPE',
      fees: 400,
      volume: 20000,
      transactions: 80,
    },
  ],
}

describe('EarningsBreakdown', () => {
  it('shows the venue tab by default and switches tabs', () => {
    render(<EarningsBreakdown summary={summary} />)
    expect(screen.getByText('Amaena')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Canal online' }))
    expect(screen.getByText('Amaena online')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/earnings/EarningsBreakdown.test.tsx`
Expected: FAIL — cannot resolve `./EarningsBreakdown`.

- [ ] **Step 4: Implement** (use the DataTable column API confirmed in Step 1; `formatMoney` for money cells, `Badge tone="muted"` for providerCode/type)

```tsx
// src/features/earnings/EarningsBreakdown.tsx
import { useState } from 'react'
import { DataTable } from '@/shared/data-table/DataTable'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { formatMoney } from '@/shared/lib/money'
import type { EarningsSummary } from './types'

type TabKey = 'venue' | 'merchant' | 'provider' | 'card' | 'channel'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'venue', label: 'Negocio' },
  { key: 'merchant', label: 'Merchant' },
  { key: 'provider', label: 'Proveedor' },
  { key: 'card', label: 'Tarjeta' },
  { key: 'channel', label: 'Canal online' },
]

const intFmt = new Intl.NumberFormat('es-MX')
const pct = (n: number) => `${(n * 100).toFixed(2)}%`

export function EarningsBreakdown({ summary }: { summary: EarningsSummary }) {
  const [tab, setTab] = useState<TabKey>('venue')

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={t.key === tab ? 'secondary' : 'ghost'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* NOTE: replace `columns`/`data`/accessors below with the exact DataTable API
          confirmed in Step 1. Each `cell` renders money via formatMoney and codes via <Badge>. */}
      {tab === 'venue' && (
        <DataTable
          data={summary.byVenue}
          columns={[
            { id: 'venueName', header: 'Negocio', cell: (r) => r.venueName },
            {
              id: 'volume',
              header: 'Volumen',
              cell: (r) => <span className="tabular-nums">{formatMoney(r.volume)}</span>,
              align: 'right',
            },
            {
              id: 'profit',
              header: 'Ganancia',
              cell: (r) => <span className="tabular-nums">{formatMoney(r.profit)}</span>,
              align: 'right',
            },
            {
              id: 'transactions',
              header: 'Txns',
              cell: (r) => <span className="tabular-nums">{intFmt.format(r.transactions)}</span>,
              align: 'right',
            },
          ]}
        />
      )}
      {tab === 'merchant' && (
        <DataTable
          data={summary.byMerchant}
          columns={[
            { id: 'label', header: 'Merchant', cell: (r) => r.label },
            {
              id: 'providerCode',
              header: 'Proveedor',
              cell: (r) => (
                <Badge tone="muted" size="sm">
                  {r.providerCode}
                </Badge>
              ),
            },
            {
              id: 'volume',
              header: 'Volumen',
              cell: (r) => <span className="tabular-nums">{formatMoney(r.volume)}</span>,
              align: 'right',
            },
            {
              id: 'profit',
              header: 'Ganancia',
              cell: (r) => <span className="tabular-nums">{formatMoney(r.profit)}</span>,
              align: 'right',
            },
            {
              id: 'transactions',
              header: 'Txns',
              cell: (r) => <span className="tabular-nums">{intFmt.format(r.transactions)}</span>,
              align: 'right',
            },
          ]}
        />
      )}
      {tab === 'provider' && (
        <DataTable
          data={summary.byProvider}
          columns={[
            { id: 'providerName', header: 'Proveedor', cell: (r) => r.providerName },
            {
              id: 'volume',
              header: 'Volumen',
              cell: (r) => <span className="tabular-nums">{formatMoney(r.volume)}</span>,
              align: 'right',
            },
            {
              id: 'cost',
              header: 'Costo',
              cell: (r) => <span className="tabular-nums">{formatMoney(r.cost)}</span>,
              align: 'right',
            },
            {
              id: 'transactions',
              header: 'Txns',
              cell: (r) => <span className="tabular-nums">{intFmt.format(r.transactions)}</span>,
              align: 'right',
            },
          ]}
        />
      )}
      {tab === 'card' && (
        <DataTable
          data={summary.byCardType}
          columns={[
            {
              id: 'type',
              header: 'Tipo',
              cell: (r) => (
                <Badge tone="muted" size="sm">
                  {r.type}
                </Badge>
              ),
            },
            {
              id: 'volume',
              header: 'Volumen',
              cell: (r) => <span className="tabular-nums">{formatMoney(r.volume)}</span>,
              align: 'right',
            },
            {
              id: 'profit',
              header: 'Ganancia',
              cell: (r) => <span className="tabular-nums">{formatMoney(r.profit)}</span>,
              align: 'right',
            },
            {
              id: 'margin',
              header: 'Margen',
              cell: (r) => <span className="tabular-nums">{pct(r.margin)}</span>,
              align: 'right',
            },
          ]}
        />
      )}
      {tab === 'channel' && (
        <DataTable
          data={summary.byChannel}
          columns={[
            { id: 'label', header: 'Canal', cell: (r) => r.label },
            {
              id: 'providerCode',
              header: 'Proveedor',
              cell: (r) => (
                <Badge tone="muted" size="sm">
                  {r.providerCode}
                </Badge>
              ),
            },
            {
              id: 'volume',
              header: 'Volumen',
              cell: (r) => <span className="tabular-nums">{formatMoney(r.volume)}</span>,
              align: 'right',
            },
            {
              id: 'fees',
              header: 'Comisión',
              cell: (r) => <span className="tabular-nums">{formatMoney(r.fees)}</span>,
              align: 'right',
            },
            {
              id: 'transactions',
              header: 'Txns',
              cell: (r) => <span className="tabular-nums">{intFmt.format(r.transactions)}</span>,
              align: 'right',
            },
          ]}
        />
      )}
    </section>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/earnings/EarningsBreakdown.test.tsx`
Expected: PASS. (If the DataTable API differs from the placeholder column shape, adjust column defs to the real API — the test only asserts cell text is rendered.)

- [ ] **Step 6: Commit**

```bash
git add src/features/earnings/EarningsBreakdown.tsx src/features/earnings/EarningsBreakdown.test.tsx
git commit -m "feat(earnings): add breakdown tabs (venue/merchant/provider/card/channel)"
```

---

## Task 13: `EarningsPage` + integration test (MSW)

**Files:**

- Create: `src/features/earnings/EarningsPage.tsx`
- Test: `src/features/earnings/EarningsPage.test.tsx`

- [ ] **Step 1: Confirm the DateRangePicker value/onChange API**

Run: `sed -n '1,80p' src/shared/ui/DateRangePicker.tsx`
Expected: note `DateRangeValue` shape and the `presets`/`value`/`onChange` props. Use them exactly in Step 3 (the page converts the range to `{ startDate, endDate }` ISO strings for the hooks).

- [ ] **Step 2: Write the failing integration test**

```tsx
// src/features/earnings/EarningsPage.test.tsx
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { EarningsPage } from './EarningsPage'

const baseURL = 'http://localhost:3000/api/v1'
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('EarningsPage', () => {
  it('renders KPIs from the summary endpoint', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/earnings/summary`, () =>
        HttpResponse.json({
          success: true,
          data: {
            range: { startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-31T00:00:00.000Z' },
            totals: {
              grossProfit: 128450.2,
              terminalProfit: 119800,
              onlineFees: 8650.2,
              volume: 4200000,
              transactions: 18204,
              averageMargin: 0.0306,
            },
            byVenue: [],
            byMerchant: [],
            byProvider: [],
            byCardType: [],
            byChannel: [],
          },
        }),
      ),
      http.get(`${baseURL}/superadmin/earnings/time-series`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    )
    renderWithProviders(<EarningsPage />)
    expect(await screen.findByText('$128,450.20')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/earnings/EarningsPage.test.tsx`
Expected: FAIL — cannot resolve `./EarningsPage`.

- [ ] **Step 4: Implement** (default range = current month; use the DateRangePicker API from Step 1)

```tsx
// src/features/earnings/EarningsPage.tsx
import { useState } from 'react'
import { useEarningsSummary, useEarningsTimeSeries } from './use-earnings'
import { EarningsKpis } from './EarningsKpis'
import { EarningsTrend } from './EarningsTrend'
import { EarningsBreakdown } from './EarningsBreakdown'
import { QueryError } from '@/shared/components/QueryError'
import type { Granularity } from './types'

function currentMonthRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { startDate: start.toISOString(), endDate: now.toISOString() }
}

export function EarningsPage() {
  // TODO(range-picker): wire DateRangePicker (Step 1 API) to replace this default.
  const [range] = useState(currentMonthRange)
  const [granularity, setGranularity] = useState<Granularity>('daily')

  const summaryQ = useEarningsSummary(range)
  const seriesQ = useEarningsTimeSeries(range, granularity)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-[18px] font-semibold text-[var(--ink)]">Ganancias</h1>
        {/* DateRangePicker goes here per Step 1 */}
      </header>

      {summaryQ.isError ? (
        <QueryError
          error={summaryQ.error}
          context="cargar las ganancias"
          onRetry={() => summaryQ.refetch()}
        />
      ) : summaryQ.isLoading ? (
        <p className="text-[13px] text-[var(--ink-faint)]">Calculando…</p>
      ) : summaryQ.data ? (
        <>
          <EarningsKpis totals={summaryQ.data.totals} />
          <EarningsTrend
            data={seriesQ.data ?? []}
            granularity={granularity}
            onGranularityChange={setGranularity}
          />
          <EarningsBreakdown summary={summaryQ.data} />
        </>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/earnings/EarningsPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/earnings/EarningsPage.tsx src/features/earnings/EarningsPage.test.tsx
git commit -m "feat(earnings): assemble EarningsPage (kpis + trend + breakdown)"
```

---

## Task 14: Route + sidebar nav

**Files:**

- Modify: `src/app/router.tsx`
- Modify: `src/shared/layouts/AppLayout.tsx`

- [ ] **Step 1: Add the lazy route**

In `src/app/router.tsx`, add the lazy import alongside the others:

```tsx
const EarningsPage = lazy(() =>
  import('@/features/earnings/EarningsPage').then((m) => ({ default: m.EarningsPage })),
)
```

And add the route inside the protected `<Route>` block (next to `/dashboard`):

```tsx
<Route path="/earnings" element={<EarningsPage />} />
```

- [ ] **Step 2: Add the sidebar entry**

In `src/shared/layouts/AppLayout.tsx`, add `Wallet` to the existing `lucide-react` import, then add to the **Operación** group's `items` array (after the `/dashboard` entry):

```tsx
{ to: '/earnings', label: 'Ganancias', icon: Wallet },
```

- [ ] **Step 3: Verify the route renders**

Run: `npx vitest run src/features/earnings/EarningsPage.test.tsx`
Expected: still PASS (no regression). Manual: `npm run dev`, visit `/earnings`, confirm the page + sidebar entry render.

- [ ] **Step 4: Commit**

```bash
git add src/app/router.tsx src/shared/layouts/AppLayout.tsx
git commit -m "feat(earnings): add /earnings route + sidebar nav entry"
```

---

## Task 15: README + CHANGELOG

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the page to the README**

Add "Ganancias" to the top-level pages list and note the backend endpoints `/superadmin/earnings/summary` + `/time-series`. (Match the README's existing page-list format.)

- [ ] **Step 2: Add the CHANGELOG entry**

Under `## [Unreleased]` → `### Added`:

```markdown
- Página **Ganancias** (`/earnings`): ganancia combinada terminal + en línea, filtrable por rango de fechas, con desglose por negocio/merchant/proveedor/tarjeta/canal y tendencia. Backend aditivo `/api/v1/superadmin/earnings/*`.
```

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs(earnings): document Ganancias page + endpoints"
```

---

## Task 16: Green gate

**Files:** none.

- [ ] **Step 1: Run the full check**

Run: `npm run check`
Expected: typecheck + lint + tests all pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Run the impeccable audit** (mandatory after a visible UI change)

Invoke the `impeccable:audit` skill on the Earnings page. Fix any severity ≥ "high" issues in this same change set before considering the task done.

- [ ] **Step 4: Final commit** (if the audit produced fixes)

```bash
git add -A
git commit -m "fix(earnings): address impeccable audit findings"
```

---

## Self-Review Notes (author)

- **Spec coverage:** totals + 5 breakdowns (§4.3) → Tasks 2, 12. Time-series (§4.3) → Tasks 2, 11. DateRangePicker/presets (§5.2) → Task 13 Step 1. money.ts (§5.3) → Task 6. Datetime TZ (§5.4) → handled by existing helper (table headers note TZ if a date column is added later). Drill-down (§6) → deferred (reuse `/superadmin/payment-analytics/venue/:id`; not in v1 tasks — flagged). Ganancia bruta labeling (§7) → Task 10 ("Ganancia bruta" + "Sólo terminales"). Realtime (§8) → out of scope. Tests (§9) → Tasks 1,6,10,11,12,13 + psql (Task 3). README/CHANGELOG (§10) → Task 15. Double-count guard (§11) → Task 3 Step 1.
- **Deferred (not a gap, scoped out of v1):** per-venue drill-down click-through (§6) and the `/superadmin/earnings/export` endpoint — the page ships with DataTable's built-in CSV export over the loaded rows; a dedicated row-level export endpoint is a follow-up.
- **Type consistency:** `EarningsSummary`/`VenueEarnings`/`EarningsTimePoint` etc. are defined identically in backend (Task 2) and frontend (Task 7). `mergeByVenue`/`mergeTimeSeries`/`centsToMxn` names match between Task 1 (definition/test) and Task 2 (use).
