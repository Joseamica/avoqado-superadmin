# Retroactive Rate Correction — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. **No commits, no branches, no worktrees — work in the existing tree on the current branch.**

**Goal:** In `avoqado-superadmin`, when an operator edits a venue's pricing, offer a confirmation dialog to **apply the new rate retroactively** to historical payments — with a live preview (count, impact, missing-cost handling), optional date range, and a typed confirmation. Plus a small reversal affordance.

**Architecture:** Reuse the existing merchant rate-edit flow (`EditVenuePricingDrawer` → `useSaveVenuePricing`). "Guardar" opens a new `RetroactiveRateDialog`. Forward-only path calls the existing `saveVenuePricing`; the retroactive path calls the new backend endpoints under `/api/v1/superadmin/rate-corrections/*` (already built + dev-verified). All data flows through the `api` client + TanStack Query; errors through `inspectApiError` + toasts.

**Tech Stack:** React 18 + Vite, TanStack Query, Tailwind v4, Vitest + RTL + MSW. Design per `.impeccable.md` (GitHub Dark, Inter content, Badge/Button/Dialog/DateRangePicker/Checkbox primitives, Spanish microcopy, tabular-nums, teaching empty states).

**Backend contract (verified, live):**

- `POST /superadmin/rate-corrections/venues/:venueId/preview` body `{ accountType, newVenueRates?, newProviderRates?, dateFrom?, dateTo?, missingCostMode }` → `{ merchantAccountId, inScopeCount, withCostCount, missingCostCount, beforeFeeTotal, afterFeeTotal, estimatedImpact, negativeMarginCount, costStructureAvailable, venuePricingAvailable }`. Read-only.
- `POST /superadmin/rate-corrections/venues/:venueId/apply` same body → the `RateCorrectionBatch`. Updates the pricing structure AND rewrites history.
- `POST /superadmin/rate-corrections/:batchId/reverse` → reversed batch.
- `GET /superadmin/rate-corrections?venueId=` → batches (with `merchantAccount`, `appliedBy`).
- `newVenueRates`/`newProviderRates` shape: `{ debitRate, creditRate, amexRate, internationalRate, includesTax?, taxRate?, fixedFeePerTransaction? }` — **raw** rates (0..1), same representation the front already edits in `CardRatesInput`.
- `missingCostMode`: `'FIX_PAYMENT_ONLY' | 'CREATE_COST'`. `accountType`: `'PRIMARY'|'SECONDARY'|'TERTIARY'` (= `AccountSlot`).

## File Structure

```
src/features/merchants/
├── api.ts                          # +types +preview/apply/reverse/list fns          (FT1)
├── use-rate-correction.ts          # NEW: hooks (preview/apply/reverse/list)          (FT1)
├── RetroactiveRateDialog.tsx       # NEW: the confirmation dialog                     (FT2)
├── RetroactiveRateDialog.test.tsx  # NEW                                              (FT2)
├── EditVenuePricingDrawer.tsx      # MODIFY: "Guardar" opens the dialog               (FT3)
└── RateCorrectionHistory.tsx       # NEW (optional): list + undo on merchant detail   (FT5)
CHANGELOG.md / README.md            # MODIFY                                           (FT4)
```

---

## FT1: API client + hooks

**Files:** Modify `src/features/merchants/api.ts`; create `src/features/merchants/use-rate-correction.ts`; test in `src/features/merchants/use-rate-correction.test.ts` (or extend `api.test.ts`).

- [ ] **Step 1 — types + api fns** (append to `api.ts`, match the existing `api` import + style):

```ts
// ── Rate correction (retroactive) ──
export type MissingCostMode = 'FIX_PAYMENT_ONLY' | 'CREATE_COST'

export interface RateSetInput {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax?: boolean | null
  taxRate?: number | null
  fixedFeePerTransaction?: number | null
}

export interface RateCorrectionParams {
  accountType: AccountSlot
  newVenueRates?: RateSetInput
  newProviderRates?: RateSetInput
  dateFrom?: string // ISO
  dateTo?: string // ISO
  missingCostMode: MissingCostMode
}

export interface RateCorrectionPreview {
  merchantAccountId: string
  inScopeCount: number
  withCostCount: number
  missingCostCount: number
  beforeFeeTotal: number
  afterFeeTotal: number
  estimatedImpact: number
  negativeMarginCount: number
  costStructureAvailable: boolean
  venuePricingAvailable: boolean
}

export interface RateCorrectionBatch {
  id: string
  venueId: string
  merchantAccountId: string
  accountType: AccountSlot
  status: 'PENDING' | 'APPLIED' | 'FAILED' | 'REVERSED'
  paymentCount: number
  costCreatedCount: number
  estimatedImpact: number | string
  appliedAt: string | null
  reversedAt: string | null
  createdAt: string
  merchantAccount?: { id: string; displayName: string | null; alias: string | null }
  appliedBy?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
}

export async function previewRateCorrection(
  venueId: string,
  params: RateCorrectionParams,
): Promise<RateCorrectionPreview> {
  const { data } = await api.post<{ data: RateCorrectionPreview }>(
    `/superadmin/rate-corrections/venues/${encodeURIComponent(venueId)}/preview`,
    params,
  )
  return data.data
}

export async function applyRateCorrection(
  venueId: string,
  params: RateCorrectionParams,
): Promise<RateCorrectionBatch> {
  const { data } = await api.post<{ data: RateCorrectionBatch }>(
    `/superadmin/rate-corrections/venues/${encodeURIComponent(venueId)}/apply`,
    params,
  )
  return data.data
}

export async function reverseRateCorrection(batchId: string): Promise<RateCorrectionBatch> {
  const { data } = await api.post<{ data: RateCorrectionBatch }>(
    `/superadmin/rate-corrections/${encodeURIComponent(batchId)}/reverse`,
    {},
  )
  return data.data
}

export async function listRateCorrections(venueId?: string): Promise<RateCorrectionBatch[]> {
  const { data } = await api.get<{ data: RateCorrectionBatch[] }>('/superadmin/rate-corrections', {
    params: venueId ? { venueId } : {},
  })
  return data.data
}
```

> **Verified:** the `api` client is plain axios (`api.get/post` → `{ data }` = response body). The backend controllers wrap the payload in `{ data: ... }` (consistent with all superadmin endpoints — `getActiveVenuePricing`/`fetchActiveCost`/earnings all read `data.data`), so these read `data.data`. MSW mocks in tests must return `{ data: <payload> }`.

- [ ] **Step 2 — hooks** (`use-rate-correction.ts`):

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyRateCorrection,
  listRateCorrections,
  previewRateCorrection,
  reverseRateCorrection,
  type RateCorrectionParams,
} from './api'
import { MERCHANTS_QUERY_KEY } from './use-merchants'

const RATE_CORRECTION_KEY = ['superadmin', 'rate-corrections'] as const

export function useApplyRateCorrection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { venueId: string; params: RateCorrectionParams }) =>
      applyRateCorrection(v.venueId, v.params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['superadmin', 'earnings'] })
      qc.invalidateQueries({ queryKey: RATE_CORRECTION_KEY })
    },
  })
}

export function useReverseRateCorrection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (batchId: string) => reverseRateCorrection(batchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['superadmin', 'earnings'] })
      qc.invalidateQueries({ queryKey: RATE_CORRECTION_KEY })
    },
  })
}

export function useRateCorrections(venueId?: string) {
  return useQuery({
    queryKey: [...RATE_CORRECTION_KEY, venueId ?? null],
    queryFn: () => listRateCorrections(venueId),
    staleTime: 30_000,
  })
}

// Imperative preview — the dialog calls this on demand (debounced), not as a standing query.
export { previewRateCorrection }
```

- [ ] **Step 3 — test** (Vitest + MSW): mock `POST /superadmin/rate-corrections/venues/:id/preview` and `/apply`; assert `previewRateCorrection` returns the parsed body and `useApplyRateCorrection` calls the endpoint + invalidates. Follow the existing `src/features/merchants/api.test.ts` + `src/test/render.tsx` patterns. Run `npm test -- use-rate-correction`.

- [ ] **Step 4 — NO commit.**

---

## FT2: RetroactiveRateDialog component

**Files:** create `src/features/merchants/RetroactiveRateDialog.tsx` + `.test.tsx`.

**Design (per `.impeccable.md`):** a `Dialog` (focused confirmation is a justified modal for a hard-to-reverse financial action). Spanish microcopy. Default = **forward-only** (safe). A `Checkbox` "También recalcular las transacciones pasadas" reveals the retroactive section: preview numbers, a missing-cost choice (only shown when `missingCostCount > 0`), an optional `DateRangePicker`, the `estimatedImpact` (right-aligned, tabular-nums, `Badge` tone by sign), a negative-margin warning when `negativeMarginCount > 0`, and a typed-confirm input (must type `APLICAR`). Teaching empty/info states.

- [ ] **Step 1 — props + behavior:**

```ts
interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  venueId: string
  venueName: string
  slot: AccountSlot
  newRates: CardRates // raw rates the operator just entered
  includesTax: boolean
  taxRate: number
  fixedFeePerTransaction: number | null
  /** forward-only save (existing behavior) */
  onSaveForward: () => Promise<void>
  onDone: () => void
}
```

Behavior:

- When `open` and the retroactive checkbox is on, call `previewRateCorrection(venueId, { accountType: slot, newVenueRates, missingCostMode, dateFrom?, dateTo? })` (via `useQuery` keyed on the params, or imperative on open/param-change). Show loading, then the numbers. Errors → `<QueryError>` / inline via `inspectApiError`.
- `newVenueRates` = `{ debit/credit/amex/internationalRate from newRates, includesTax, taxRate, fixedFeePerTransaction }`.
- Two primary actions:
  - Retroactive OFF → button "Guardar" → `await onSaveForward()` → toast → `onDone()`.
  - Retroactive ON → button enabled only when typed-confirm === `APLICAR` and `preview.venuePricingAvailable` and (`missingCostMode !== 'CREATE_COST'` or `preview.costStructureAvailable`) → `useApplyRateCorrection().mutateAsync({ venueId, params })` → `toast.success('N pagos recalculados')` → `onDone()`.
- Missing-cost choice via two `Checkbox`/radio rows or a `Combobox` (2 options): "Sólo arreglar el cobro (Payment + liquidación)" vs "Crear también el detalle de costo" (disabled with explanation when `!costStructureAvailable`). Default `FIX_PAYMENT_ONLY`.
- Date range via `<DateRangePicker showTime={false}>` returning `DateRangeValue` → map to ISO `dateFrom`/`dateTo`; default empty = all history (copy: "Todo el histórico").
- Impact line: `formatCurrency`/tabular-nums, right-aligned; `<Badge tone={impact>=0?'success':'danger'}>`.
- All money/number cells `tabular-nums`. Use `formatDateTime`/datetime helper if showing dates.

- [ ] **Step 2 — test** (RTL + MSW): renders forward-only by default; checking the box fetches+shows preview (mock the preview endpoint); the apply button is disabled until `APLICAR` is typed; typing it + clicking calls the apply endpoint; missing-cost option disabled when `costStructureAvailable:false`. Use `renderWithProviders`.

- [ ] **Step 3 — NO commit.**

---

## FT3: Wire into EditVenuePricingDrawer

**Files:** modify `src/features/merchants/EditVenuePricingDrawer.tsx` + its test.

- [ ] **Step 1:** Replace the direct-save in `handleSubmit`. On submit, instead of calling `save.mutateAsync` directly, open `RetroactiveRateDialog` (a new `const [confirmOpen, setConfirmOpen] = useState(false)`), passing the entered `rates`, `includesTax`, `taxRate`, `fixedFeePerTransaction`, and an `onSaveForward` that runs the existing `save.mutateAsync(...)` + toast. The dialog's `onDone` closes both the dialog and the drawer (`onSaved?.(); onOpenChange(false)`). Keep the existing forward-save logic intact inside `onSaveForward` (do NOT remove it — it's the default path). Render `<RetroactiveRateDialog ... />` alongside the `<Drawer>`.
- [ ] **Step 2:** Update `EditVenuePricingDrawer.test.tsx` so the existing save test still passes (it now goes through the dialog's forward path — adapt the test to click through "Guardar" in the dialog, or assert the dialog opens). Add a test that choosing retroactive calls the apply endpoint.
- [ ] **Step 3 — NO commit.**

---

## FT4: CHANGELOG + README + audit

- [ ] **Step 1:** Add a `CHANGELOG.md` entry under `[Unreleased] · Added`: "Corrección retroactiva de tasas: al editar el pricing de un venue, opción de recalcular las transacciones pasadas (preview de impacto, manejo de pagos sin costo, rango de fechas, confirmación tipeada) — reversible y auditado. Backend `/superadmin/rate-corrections/*`."
- [ ] **Step 2:** README: if it lists top-level features/pages or API areas, add the rate-corrections capability. If nothing relevant, skip (note why).
- [ ] **Step 3:** Run `npm run check` (lint + typecheck + tests) and `npm run build` — both must be green. Fix any issues in the new files.
- [ ] **Step 4:** Invoke `impeccable:audit` on the new dialog; fix severity ≥ high.
- [ ] **Step 5 — NO commit.**

---

## FT5 (optional / follow-up): Reversal UI

A `RateCorrectionHistory` section on the merchant/venue detail listing `useRateCorrections(venueId)` rows (date, who, old→new, paymentCount, impact, status `<Badge>`), with a "Deshacer" `Button` on `APPLIED` rows calling `useReverseRateCorrection`. Teaching empty state ("No hay correcciones de tasa para este venue."). Confirm-on-undo. Tests. Can ship after FT1-FT4.

---

## Self-review notes

- Forward-only remains the default and untouched path (no regression to normal rate edits).
- The retroactive apply endpoint updates the pricing structure itself, so the retroactive path must NOT also call `saveVenuePricing` (double-write). Only one of the two paths runs.
- Rates sent are RAW (matching `CardRatesInput`), with `includesTax`/`taxRate` — consistent with `saveVenuePricing` and the backend `newVenueRates`.
