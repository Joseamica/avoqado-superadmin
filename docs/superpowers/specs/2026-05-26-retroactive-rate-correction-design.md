# Retroactive Rate Correction — Design Spec

**Date:** 2026-05-26
**Status:** Draft — pending user review
**Repos touched:** `avoqado-server` (heavy), `avoqado-superadmin` (UI)
**Related:** [F2 economics editable](2026-05-25-merchant-accounts-f2-economics-editable-design.md) · [Superadmin earnings](2026-05-26-superadmin-earnings-design.md)

---

## 1. Problem

Legacy venues have **wrong card rates stored** in the system (e.g. a venue shows 1% when the agreed rate was always 5.5%). Because every payment **freezes a snapshot of the rate at record time**, all of that venue's historical payments carry the wrong fee/net economics. The reports the operator (and the client) look at — liquidación, ganancias, márgenes — are therefore wrong for these venues, and "que estén actualizados es altamente relevante".

Today, editing a rate only fixes the config going forward; it does **not** touch the frozen history.

### What the numbers actually drive (confirmed with the user)

The settlement/liquidación numbers are **informational**. There is **no automated payout API** that deposits money based on `Payment.netAmount`; the real deposit is done manually "por fuera". So correcting historical snapshots is a **reporting-accuracy correction**, not a restatement of money that physically moved through the system. **The client wants to see the correct figure — that is the whole point.**

This significantly lowers the risk: we are fixing wrong reporting data, not falsifying executed transfers. We still treat it as financial data (preserve originals, audit, reversible).

---

## 2. Goal & non-goals

### Goal

A **superadmin feature**: when an operator edits the **venue pricing and/or the provider cost** for a venue+merchant, a dialog offers to **apply the corrected rates retroactively** to that scope's historical payments. On confirm, the system recomputes the frozen economics so every existing report reflects the corrected rates — scoped, previewed, audited, and reversible. The operator knows the risk and accepts that, going forward, all calculations are based on the new provider **and** merchant commission ("lo asignado").

**No manual data fix.** We do not run any one-time script against production. The only thing that ever rewrites historical payments is this feature, triggered by the operator through the UI with explicit confirmation.

### Non-goals

- **No** global "fix everything" button. Correction is always **per venue + per merchant account** — the operator decides case by case.
- **No** change to how live payments are recorded.
- **No** rewrite of any downstream reader (settlement report, earnings, available balance). They keep reading the same fields; those fields just become correct.
- **No** attempt to retro-change artifacts already emitted (emails already sent, commissions already paid, CSVs exported). See Risk #2.

---

## 3. Key domain findings (grounded in code + prod data)

### 3.1 The fee snapshot lives in THREE tables — all must update consistently

At payment record time (`avoqado-server/src/services/tpv/payment.tpv.service.ts:1708-1736`), after `createTransactionCost()` computes economics, the code writes:

1. **`Payment`** → `feePercentage`, `feeAmount`, `netAmount`
2. **`VenueTransaction`** → `feeAmount`, `netAmount`, `netSettlementAmount` ← **the liquidación report reads from here**
3. **`TransactionCost`** (1:1 with Payment) → `venueRate`, `venueChargeAmount`, `providerRate`, `providerCostAmount`, `grossProfit`, `profitMargin`

> The backfill **must** update all three in the same transaction, or the liquidación report (reads `VenueTransaction`) and the earnings dashboard (reads `TransactionCost`) would diverge.

### 3.2 The recompute reuses the existing live formula — zero duplication

`avoqado-server/src/services/pricing/cost-calculation.service.ts` already exposes `calculateTransactionCost({ amount, transactionType, pricing, cost })` → returns `venueRate`, `venueChargeAmount`, `grossProfit`, `profitMargin`, `netAmount`, etc. It is **IVA-aware** via `applyTaxIfNeeded()` / `includesTax`. The backfill re-runs this exact function per historical payment with the corrected pricing structure → the recomputed numbers are identical in logic to live computation. This directly satisfies the CLAUDE.md "reuse the shared service unmodified" rule.

> ⚠️ **IVA double-apply trap** (known repo bug class — see memory `merchant-rate-inputs-edit-raw`): the recompute must use the **raw/base** rate with the same `includesTax` semantics, never the already-effective rate. Reusing `calculateTransactionCost` as-is avoids this; tests must cover `includesTax` = true / false / null.

### 3.3 Scope mapping: `accountType` ↔ `merchantAccount` ↔ payments

- A rate edit targets a `VenuePricingStructure` keyed by **(`venueId`, `accountType`)** where `accountType ∈ {PRIMARY, SECONDARY, TERTIARY}`.
- `accountType` maps to a specific `MerchantAccount` via **`VenuePaymentConfig`** (`PrimaryAccount` / `SecondaryAccount` / `TertiaryAccount` relations).
- `Payment` carries both `venueId` and `merchantAccountId`.
- **Scope of a correction = payments where `venueId = X` AND `merchantAccountId = <account for that accountType>` AND `status = COMPLETED`**, optionally within a date range.

### 3.4 Production reality (read-only query, 2026-05-26)

- **4,138** COMPLETED payments; **2,130** have `TransactionCost` (51.5%); **2,008** do **not** (~48.5%), across **34 venues**.
- The **BAE** chain = the legacy venues; mostly missing cost, but **tiny amounts** (many ≈ $0). Real-money missing-cost venues are few: **Mindform** (~$49.5k), **Alberto Dominguez** (~$20.2k), **Berthe**, **Amaena**, **Doña Simona**.
- Implication: ~half of payments have **no** `TransactionCost` row, so the "what to do with missing-cost payments" choice is material, not a corner case → it becomes a **per-execution choice in the dialog** (§4.3).

### 3.5 Two-layer economics — what auto-corrects vs what must be rewritten

The system computes economics in **two distinct layers**, and the feature must respect the difference:

| Layer                               | What                                                                                                                                                       | Auto-corrects when rates change?                                                                                                                                                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rate structures** ("lo asignado") | `ProviderCostStructure` · `VenuePricingStructure` · `MerchantRevenueShare`                                                                                 | **Yes.** Report-time calcs read them live: backend `computeRevenueShare` and frontend `computeMerchantEconomics` (`src/features/merchants/economics.ts`) project from the structures — aggregator-aware (4 modes), no per-payment snapshot. Edit a structure → these reflect it immediately. |
| **Frozen per-payment snapshots**    | `Payment.{feeAmount,netAmount,feePercentage}` · `VenueTransaction.{feeAmount,netAmount,netSettlementAmount}` · `TransactionCost.{venueRate,grossProfit,…}` | **No.** Recorded with the old rate. This is what the retroactive backfill rewrites. `earnings.service.ts` (the Ganancias dashboard) and the liquidación report read these.                                                                                                                   |

**Scope of "the rates":** the operator may edit the **provider cost** and/or the **venue pricing** (and, where it exists, the aggregator/revenue-share config). On retroactive apply, the backfill updates whichever structures changed and recomputes every in-scope payment against the **now-current** assigned structures — so both the venue charge (liquidación) and the margin (earnings) reflect the new provider **and** merchant commission, with/without IVA (`includesTax` honored).

### 3.6 The grossProfit / earnings decision (aggregator) — DECIDED

`TransactionCost.grossProfit` stores the **full margin** (`venueCharge − providerCost`), and `earnings.service.ts` sums it. This is **not** aggregator-split-aware. Production reality (read-only, 2026-05-26): **38** merchant accounts, **19** carry an `aggregatorId`, but **only 3** have a `MerchantRevenueShare` row (the config that actually triggers a split via `computeRevenueShare`). Without that row, `computeRevenueShare` attributes the whole margin to Avoqado — so full margin **is** the real earnings.

**Decision:** the backfill writes `grossProfit = venueCharge − providerCost` (full margin), **identical to the live `createTransactionCost`**. Consequences:

- For the ~35 merchants without a split config → after the rewrite, `EarningsPage` shows the **real** Avoqado earnings. ✅
- For the **3** merchants with `MerchantRevenueShare` → full margin over-states; `EarningsPage` stays inflated until the follow-up below.
- The live payment path (`createTransactionCost`) is **not** touched.

**Follow-up (out of scope here, tracked):** make `earnings.service.ts` split-aware by computing per-payment via `computeRevenueShare`/`MerchantRevenueShare` at report-time (exactly what that model was designed for — _"el cálculo es report-time"_). This makes `EarningsPage` real for the 3 aggregator merchants too, applied uniformly to all payments, **without** touching the live path or rewriting history.

---

## 4. The feature (frontend — `avoqado-superadmin`)

### 4.1 Trigger

Hooks into the **existing** rate-edit flow (`EditVenuePricingDrawer.tsx` / `EditEconomicsDrawer.tsx` + `use-merchants.ts`). When the operator changes a rate and saves, instead of saving silently, a **confirmation dialog** appears offering the retroactive option.

### 4.2 The dialog (the thing the user asked for)

Two semantics as two explicit choices:

- **"Sólo de aquí en adelante"** → current behavior: update the `VenuePricingStructure`, do not touch history.
- **"Aplicar también a transacciones pasadas"** → update config **and** run the retroactive backfill scoped to this venue + merchant account.

If retroactive is chosen, the dialog shows a **preview fetched from the backend before any write**:

```
Café Mindform · Banorte PRIMARY · Crédito 1% → 5.5%
─────────────────────────────────────────────
Pagos COMPLETED en scope:        151
  · con TransactionCost:          0   → se recalculan
  · sin TransactionCost:        151   → ¿qué hago con estos?
                                         ( ) Sólo arreglar Payment + VenueTransaction
                                         (•) Crear también el TransactionCost faltante
Rango:  2024-03-01 → hoy   [DateRangePicker, opcional, default todo]
Impacto estimado en Ganancias Avoqado:  +$2,180.00
⚠ 0 pagos quedarían con margen negativo
─────────────────────────────────────────────
        [ Cancelar ]   [ Aplicar a estos 151 ]   ← requires typed confirm
```

- **Per venue + merchant**, the operator decides: date range, missing-cost handling, and confirms **seeing the impact first**.
- Uses existing primitives: `Drawer`/`Dialog`, `DateRangePicker`, `Combobox`, `Badge`, `Button`, money right-aligned + `tabular-nums`, empty/teaching states, error via `inspectApiError` + `QueryError`/`toast`. Per `.impeccable.md`.
- **Typed confirmation** ("escribe APLICAR") gate because it's a hard-to-reverse, outward-facing financial action.

### 4.3 Missing-cost handling — a per-execution radio in the dialog (not a global setting)

- **"Crear también el TransactionCost faltante"** → fixes `Payment` + `VenueTransaction` for all in scope, and **creates** the missing `TransactionCost` rows using the applicable `ProviderCostStructure`. Earnings then covers them. Requires the venue/account to have a provider cost structure (backend validates; if absent, this option is disabled with an explanation).
- **"Sólo arreglar Payment + VenueTransaction"** → liquidación report becomes correct for all; missing-cost payments stay out of the margin/earnings view. Simpler, invents no provider cost.

### 4.4 Reversibility surface

A small "Correcciones de tasa" history (per venue, or a global superadmin list) showing each `RateCorrectionBatch`: when, who, old→new, rows affected, $ impact, status, and an **"Deshacer"** action that restores the per-payment before-values.

---

## 5. Backend design (`avoqado-server`)

### 5.1 Namespace & API evolution

- All new endpoints under **`/api/v1/superadmin/*`** (never `/dashboard/*`). Additive only. (CLAUDE.md namespace + API-evolution rules.)
- Reuse `calculateTransactionCost` / cost-calc helpers **unmodified** (safe; shared with legacy). New orchestration logic lives in a **new** service so the legacy path is untouched.

### 5.2 New model: `RateCorrectionBatch` (+ `RateCorrectionEntry`)

Captures everything needed for audit + reversal:

- `RateCorrectionBatch`: `id`, `venueId`, `merchantAccountId`, `accountType`, `cardTypeScope` (which rates changed), `oldRates` (JSON), `newRates` (JSON), `dateFrom?`, `dateTo?`, `missingCostMode` (FIX_PAYMENT_ONLY | CREATE_COST), `status` (PENDING | APPLIED | FAILED | REVERSED), `paymentCount`, `costCreatedCount`, `estimatedImpact`, `appliedById`, `appliedAt`, `reversedById?`, `reversedAt?`.
- `RateCorrectionEntry` (per payment): `batchId`, `paymentId`, **before** snapshot (`feeAmount`, `netAmount`, `feePercentage`, plus VenueTransaction + TransactionCost before-values, or `costCreated=true` marker), **after** snapshot. This is the reversal source of truth.
- Migration: additive (new tables only). No change to existing tables.

### 5.3 Endpoints

1. **`POST /superadmin/venues/:venueId/rate-correction/preview`** — body: `{ accountType, newRates, dateFrom?, dateTo?, missingCostMode }`. Read-only. Returns `{ inScopeCount, withCostCount, missingCostCount, estimatedImpact, negativeMarginCount, costStructureAvailable }`. Powers the dialog preview. **No writes.**
2. **`POST /superadmin/venues/:venueId/rate-correction/apply`** — same body + typed-confirm token. Runs the backfill (see §5.4), returns the created `RateCorrectionBatch`.
3. **`POST /superadmin/rate-corrections/:batchId/reverse`** — restores before-values for that batch's entries, marks `REVERSED`.
4. **`GET /superadmin/venues/:venueId/rate-corrections`** (+ optional global list) — batch history.

### 5.4 The backfill (idempotent, chunked, transactional)

1. Resolve scope: payments for (`venueId`, `merchantAccountId` derived from `accountType`), `status = COMPLETED`, within date range. Snapshot the **exact payment id set** + a cutoff timestamp (so live writes during the run aren't silently swept in).
2. Update the `VenuePricingStructure` (config, future correctness) — same as the "forward-only" path.
3. For each payment, in **chunks inside a transaction**:
   - Re-run `calculateTransactionCost` with the corrected pricing (+ provider cost structure).
   - Record the **before** values into `RateCorrectionEntry`.
   - Update `Payment` (`feePercentage`, `feeAmount`, `netAmount`), `VenueTransaction` (`feeAmount`, `netAmount`, `netSettlementAmount`), and `TransactionCost` (`venueRate`, `venueChargeAmount`, `grossProfit`, `profitMargin`, and `providerRate`/`providerCostAmount` if recomputed). If missing-cost + `CREATE_COST`, **create** the `TransactionCost`.
4. Mark batch `APPLIED` with counts + impact. On any chunk failure → mark `FAILED`; already-applied chunks are recorded in entries so the batch can be reversed cleanly. Re-runnable.
5. **`ActivityLog`** entry (mandatory): actor, venue, merchant, accountType, old→new rates, rows affected, batch id.
6. Emit a small realtime event (`superadmin:rate-correction:applied`) → frontend invalidates affected `['superadmin', ...]` query keys (earnings, merchant economics, liquidación).

### 5.5 Execution model

Synchronous for small scopes (preview shows the count). For large scopes (e.g. > N payments) run as a **background job with batch status + progress**, not a blocking request — avoids lock contention with live API / settlement jobs. Threshold TBD in plan; prod's largest single-venue missing-cost set is ~178, so most cases are small, but Testarudo (927) / Mindform (720) total payments mean the job path is needed.

---

## 6. Edge cases & rules

- **Status filter:** only `COMPLETED`. Refunded / voided / pending are **skipped** (recomputing fee on a reversed payment would misstate it).
- **Provider cost side:** the operator is editing the **venue-facing** rate. Provider cost is taken from the applicable `ProviderCostStructure` (recomputed consistently so margin makes sense); we do **not** invent provider cost unless `CREATE_COST` is chosen and a structure exists.
- **Negative margin guard:** if recompute yields `grossProfit < 0` for any payment (venue charged below provider cost), surface the count in preview and require explicit acknowledgement.
- **Missing provider cost structure:** `CREATE_COST` option disabled, with a clear reason; `FIX_PAYMENT_ONLY` still available.
- **Concurrency:** lock the `VenuePricingStructure` during apply; the batch operates on a frozen payment-id set; block a second un-reversed overlapping batch on the same scope (reverse in LIFO order).
- **Legitimate historical rate changes:** the feature assumes "the rate was always X". The optional date range lets the operator avoid overwriting a genuine past rate period. This is a **human judgement** the UI surfaces but cannot decide (Risk #1).

---

## 7. Risks & mitigations (carried from discussion)

**Mitigated by design:** lost original (→ `RateCorrectionEntry` before-snapshot) · typo propagation (→ preview + impact + typed confirm + reverse) · IVA double-apply (→ reuse `calculateTransactionCost`, test includesTax matrix) · mixed state on crash (→ chunked tx + batch status, idempotent) · perf/locks (→ background job) · negative margin (→ preview guard) · wrong scope (→ precise venue+account+accountType mapping) · refunds (→ COMPLETED only) · **the 3-table sync** (→ update Payment + VenueTransaction + TransactionCost together).

**Inherent (accepted with judgement):**

1. "Always was X" premise — operator decides, date range helps.
2. Already-emitted artifacts won't retro-change; DB becomes self-consistent but diverges from what already left the building (the `ActivityLog` + batch are the "as-of" record).
3. Power footgun — SUPERADMIN-only, typed confirm, full audit, reversible.

---

## 8. Testing strategy (user requires dev verification — providers→merchants is complex)

- **Server unit:** recompute math (debit/credit/amex/international × `includesTax` true/false/null), scope resolution (accountType→account), missing-cost create vs fix-only, negative-margin detection, idempotency, reversal restores exact before-values.
- **Server integration:** apply → assert Payment + VenueTransaction + TransactionCost all consistent; reverse → assert exact restore; ActivityLog written; partial-failure marks FAILED.
- **Frontend:** dialog preview rendering, missing-cost radio, date range, typed-confirm gate, error via `inspectApiError`, query invalidation on success. (`renderWithProviders` + MSW.)
- **Dev DB verification (post-build, as the user asked):** run preview (read-only) against a dev venue, apply on a **dev/test venue** (e.g. clone of a BAE venue), verify the 3 tables + earnings + liquidación reports reflect the change, then **reverse** and verify full restore. `npm run check` + `npm run build` green in both repos before declaring done. **Never run apply against prod from this work** — prod only via the audited UI by the operator.

---

## 8.1 Pre-production hardening checklist (from final code review, 2026-05-26)

The backend was implemented and is green (10 Jest suites / 35 tests, build clean). A final fresh-eyes review found **no Critical issues** and confirmed the happy path (single apply → reverse) is correct and well-tested. The following **edge-case** items are **NOT bugs in the normal flow** and are intentionally deferred — they only matter once the feature is wired to the frontend and used against production. **Harden these (carefully, with the existing tests as the regression net) BEFORE wiring to prod:**

- **H1 (double-apply guard — was spec §6):** nothing prevents running `apply` twice on the same venue+merchant scope. Re-applies are value-idempotent for `feeAmount`, but reversing batches out of order can leave orphaned/wrong `TransactionCost` rows. Add a guard rejecting (or warning on) an existing un-reversed `APPLIED` batch over an overlapping range; document LIFO reversal. _Only triggers on operator double-run._
- **H2 (atomicity):** the rate-structure writes (`updateVenuePricingStructure` + provider deactivate/create) happen **before and outside** the payment `$transaction`. If the transaction throws, the batch is `FAILED` but the live structures already changed (forward rates moved, history not rewritten) with no auto-rollback. Move the structure writes inside the same `$transaction`, or restore-on-FAILED. _Only triggers on a mid-transaction DB failure._
- **H3 (retry stacks provider structures):** the provider update is an unconditional deactivate-all-active + create. Retrying after a FAILED run stacks duplicate dead structures (and can hit the `@@unique([merchantAccountId, effectiveFrom])`). Fixed naturally by H2 (atomic) or an idempotency check. _Only triggers on retry-after-failure._
- **H4 (audit FK linkage):** newly-created `TransactionCost` rows (CREATE*COST + newProviderRates) set `providerCostStructureId`/`venuePricingStructureId` to the **pre-correction** structure ids while storing the **new** rates. Capture and use the newly-created structure id. \_Audit-linkage only; amounts are correct.*
- **Minor — `feePercentage` convention:** the apply sets `Payment.feePercentage = venueRate` (raw rate). The live TPV path leaves `feePercentage` at its creation value (often 0) and `paymentLink.service` uses `fee/gross`. Confirm no report averages/sums `Payment.feePercentage` across corrected + uncorrected payments (would mix conventions).
- **Minor — preview/apply resolver drift:** `previewRateCorrection` resolves the active `VenuePricingStructure` with `findFirst({active:true})` (no effective-date window) while `apply` uses `getActivePricingStructure` (which applies the date window). In edge cases they can disagree. Share one resolver.

> **Note:** Task 10 (realtime Socket.IO emit) was **skipped** — no generic superadmin emit helper exists in `avoqado-server`. The frontend will invalidate its TanStack Query cache optimistically on mutation success instead. Revisit only if live multi-operator refresh is needed.

## 9. Open questions for review

1. **Spec home / sequencing:** build server first (model + endpoints + job + tests), then superadmin UI? (Recommended — backend is the risk.)
2. **Batch threshold** for sync vs background job — pick a number (e.g. 200).
3. **Reversibility retention** — keep `RateCorrectionEntry` rows forever, or prune after N days? (Recommend keep; they're the audit trail.)
4. **Who can apply** — any SUPERADMIN, or a narrower gate?
5. **Reversal UI placement** — per-venue tab vs a global "Correcciones" page.

---

## 10. Decisions already made (this session)

- Approach **A**: in-place overwrite + reversible audited batch (not non-destructive columns, not on-the-fly recompute).
- All mitigations are **must-have**.
- Date range **optional**, default = all history.
- Scope **per venue + merchant account**; operator decides case by case.
- Missing-cost handling = **per-execution choice in the dialog**, not a global policy.
- Build the **feature** (not a one-time script); **then test in dev** before shipping. **No manual DB fix against prod.**
- Recompute scope = **provider cost AND/OR venue pricing** (whichever the operator edits); recomputes against the now-current assigned structures (§3.5).
- `grossProfit` = **full margin** (matches live; live path untouched). Aggregator-split-aware earnings is a **tracked follow-up** to `earnings.service.ts`, not part of this feature (§3.6).
