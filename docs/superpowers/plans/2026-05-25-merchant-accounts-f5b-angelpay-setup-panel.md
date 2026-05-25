# Merchant Accounts — F5·B: Panel de alta AngelPay · Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Panel full-screen de alta AngelPay (`/merchants/new-angelpay`) — cards de estado con gating + progreso → un POST a `full-setup-angelpay`. Mismo patrón que F5·A.

**Architecture:** Feature `merchants`. Reusa `SetupCard` (F5·A). Extrae el shell de drawer (`CardDrawer`) + `RatesDrawer` a archivos compartidos (los usaban Blumon). Lógica pura en `angelpay-setup.ts` (`buildAngelPayPayload`, **DECIMAL sin ×100**, + `effectiveFrom`).

**Tech Stack:** React 18 + TS · TanStack Query · sonner · Drawer/Combobox/Button/Badge · `CardRatesInput`/`RatesDrawer` · Vitest + RTL + MSW.

**Spec:** `docs/superpowers/specs/2026-05-25-merchant-accounts-f5b-angelpay-setup-panel-design.md`. **Restricción:** branch `develop`, sin worktree/branch, **sin commit**, sin `npm run format` global. Server aditivo deploy-first.

---

## Task B1: Extraer shell/RatesDrawer + `angelpay-setup.ts` + api/hooks

**Files:** Create `src/features/merchants/SetupDrawerKit.tsx`, `angelpay-setup.ts`, `angelpay-setup.test.ts`; Modify `BlumonSetupDrawers.tsx`, `api.ts`, `use-merchants.ts`

- [ ] **Step 1: Extraer `CardDrawer` + `RatesDrawer` a `SetupDrawerKit.tsx`** (mover desde `BlumonSetupDrawers.tsx` sin cambiar comportamiento):

```tsx
import { useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
} from '@/shared/ui/Drawer'
import { Button } from '@/shared/ui/Button'
import { CardRatesInput } from './CardRatesInput'
import type { CardRates } from './types'

export const ZERO_RATES: CardRates = { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 }

export function CardDrawer({
  open,
  onOpenChange,
  title,
  children,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  children: React.ReactNode
  onSave: () => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody>
          <div className="flex flex-col gap-4">{children}</div>
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave()
              onOpenChange(false)
            }}
          >
            Guardar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export function RatesDrawer({
  open,
  onOpenChange,
  title,
  value,
  includesTax,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  value: CardRates | null
  includesTax: boolean
  onSave: (rates: CardRates, includesTax: boolean) => void
}) {
  const [rates, setRates] = useState<CardRates>(value ?? ZERO_RATES)
  const [tax, setTax] = useState(includesTax)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      onSave={() => onSave(rates, tax)}
    >
      <CardRatesInput value={rates} onChange={setRates} idPrefix="rate" />
      <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
        <input type="checkbox" checked={tax} onChange={(e) => setTax(e.target.checked)} /> Las tasas
        ya incluyen IVA
      </label>
    </CardDrawer>
  )
}
```

- [ ] **Step 2: Update `BlumonSetupDrawers.tsx`** — remove its local `CardDrawer` + `RatesDrawer` + `ZERO_RATES`; `import { CardDrawer, RatesDrawer, ZERO_RATES } from './SetupDrawerKit'`. (Keep `INITIAL_DRAFT` importing `ZERO_RATES` working — note `ZERO_RATES` now comes from SetupDrawerKit; if `blumon-setup.ts` used it, repoint that import too.) Update `BlumonSetupPanel.tsx` if it imported `RatesDrawer` from `BlumonSetupDrawers` → from `SetupDrawerKit`.

  > Run `grep -rn "RatesDrawer\|ZERO_RATES\|CardDrawer" src/features/merchants` and repoint every import to `./SetupDrawerKit`. `npx tsc --noEmit` must stay clean and Blumon tests green.

- [ ] **Step 3: `angelpay-setup.ts`** (pure):

```ts
import type { CardRates } from './types'
import type { AngelPayFullSetupPayload } from './api'

export interface AngelPayDraft {
  venueId: string | null
  venueName: string | null
  loginMode: 'existing' | 'new'
  angelpayUserAccountId: string | null
  email: string
  pin: string
  environment: 'QA' | 'PROD'
  externalMerchantId: string
  merchantName: string
  affiliation: string
  displayName: string
  accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  slotMode: 'fill' | 'replace'
  replacedAccountId: string | null
  cost: CardRates | null
  costIncludesTax: boolean
  pricing: CardRates | null
  pricingIncludesTax: boolean
  settlement: { DEBIT: number; CREDIT: number; AMEX: number; INTERNATIONAL: number }
  settlementDayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
  cutoffTime: string
  cutoffTimezone: string
}

export const INITIAL_ANGELPAY_DRAFT: AngelPayDraft = {
  venueId: null,
  venueName: null,
  loginMode: 'new',
  angelpayUserAccountId: null,
  email: '',
  pin: '',
  environment: 'QA',
  externalMerchantId: '',
  merchantName: '',
  affiliation: '',
  displayName: '',
  accountType: 'PRIMARY',
  slotMode: 'fill',
  replacedAccountId: null,
  cost: null,
  costIncludesTax: true,
  pricing: null,
  pricingIncludesTax: true,
  settlement: { DEBIT: 1, CREDIT: 1, AMEX: 3, INTERNATIONAL: 3 },
  settlementDayType: 'BUSINESS_DAYS',
  cutoffTime: '23:00',
  cutoffTimezone: 'America/Mexico_City',
}

/** Ensamble puro del body de full-setup-angelpay. Tasas DECIMAL (SIN ×100). + effectiveFrom. */
export function buildAngelPayPayload(draft: AngelPayDraft): AngelPayFullSetupPayload {
  const now = new Date().toISOString()
  const rate = (r: CardRates, includesTax: boolean) => ({
    debitRate: r.DEBIT,
    creditRate: r.CREDIT,
    amexRate: r.AMEX,
    internationalRate: r.INTERNATIONAL,
    includesTax,
    taxRate: 0.16,
    effectiveFrom: now,
  })
  return {
    venueId: draft.venueId as string,
    login:
      draft.loginMode === 'existing'
        ? { mode: 'existing', angelpayUserAccountId: draft.angelpayUserAccountId as string }
        : { mode: 'new', email: draft.email, pin: draft.pin, environment: draft.environment },
    merchant: {
      mode: 'create',
      externalMerchantId: draft.externalMerchantId,
      name: draft.merchantName,
      affiliation: draft.affiliation,
      displayName: draft.displayName,
    },
    slot: {
      accountType: draft.accountType,
      mode: draft.slotMode,
      ...(draft.slotMode === 'replace' && draft.replacedAccountId
        ? { replacedAccountId: draft.replacedAccountId }
        : {}),
    },
    terminalIds: [],
    ...(draft.cost ? { cost: rate(draft.cost, draft.costIncludesTax) } : {}),
    ...(draft.pricing ? { pricing: rate(draft.pricing, draft.pricingIncludesTax) } : {}),
    settlement: {
      settlementDays: draft.settlement.DEBIT,
      settlementDaysByCard: { ...draft.settlement },
      settlementDayType: draft.settlementDayType,
      cutoffTime: draft.cutoffTime,
      cutoffTimezone: draft.cutoffTimezone,
      effectiveFrom: now,
    },
  }
}
```

- [ ] **Step 4: `angelpay-setup.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildAngelPayPayload, INITIAL_ANGELPAY_DRAFT } from './angelpay-setup'

describe('buildAngelPayPayload', () => {
  it('login nuevo + merchant create + cost en DECIMAL (sin ×100)', () => {
    const body = buildAngelPayPayload({
      ...INITIAL_ANGELPAY_DRAFT,
      venueId: 'v1',
      email: 'a@b.com',
      pin: '123456',
      externalMerchantId: '9814275',
      merchantName: 'X',
      affiliation: '9814',
      displayName: 'Cuenta',
      cost: { DEBIT: 0.025, CREDIT: 0.03, AMEX: 0.035, INTERNATIONAL: 0.04 },
    })
    expect(body.cost?.debitRate).toBe(0.025) // DECIMAL, no 2.5
    expect(body.cost?.effectiveFrom).toBeTruthy()
    expect(body.login).toEqual({ mode: 'new', email: 'a@b.com', pin: '123456', environment: 'QA' })
    expect(body.merchant).toMatchObject({ mode: 'create', externalMerchantId: '9814275' })
    expect(body.slot).toEqual({ accountType: 'PRIMARY', mode: 'fill' })
    expect(body.settlement?.settlementDaysByCard?.AMEX).toBe(3)
  })
  it('login existente', () => {
    const body = buildAngelPayPayload({
      ...INITIAL_ANGELPAY_DRAFT,
      venueId: 'v1',
      loginMode: 'existing',
      angelpayUserAccountId: 'acc1',
      displayName: 'C',
      externalMerchantId: '1',
      merchantName: 'm',
      affiliation: 'a',
    })
    expect(body.login).toEqual({ mode: 'existing', angelpayUserAccountId: 'acc1' })
  })
})
```

Run `npx vitest run src/features/merchants/angelpay-setup.test.ts` → pass.

- [ ] **Step 5: api.ts append**

```ts
/* ─── AngelPay full-setup (F5·B) ─── */

export interface AngelPayAccountOption {
  id: string
  email: string
  status: string
  environment: string
}

interface AngelPayRatePayload {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax: boolean
  taxRate: number
  effectiveFrom: string
}

export interface AngelPayFullSetupPayload {
  venueId: string
  aggregatorId?: string
  login:
    | { mode: 'existing'; angelpayUserAccountId: string }
    | { mode: 'new'; email: string; pin: string; environment: 'QA' | 'PROD' }
  merchant:
    | {
        mode: 'create'
        externalMerchantId: string
        name: string
        affiliation: string
        displayName: string
      }
    | { mode: 'existing'; merchantAccountId: string }
  slot: {
    accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
    mode: 'fill' | 'replace'
    replacedAccountId?: string
  }
  terminalIds?: string[]
  cost?: AngelPayRatePayload
  pricing?: AngelPayRatePayload
  settlement?: {
    settlementDays: number
    settlementDaysByCard?: {
      DEBIT?: number
      CREDIT?: number
      AMEX?: number
      INTERNATIONAL?: number
    }
    settlementDayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
    cutoffTime: string
    cutoffTimezone: string
    effectiveFrom: string
  }
}

export async function fullSetupAngelPay(
  payload: AngelPayFullSetupPayload,
): Promise<MerchantAccount> {
  const { data } = await api.post<{ data: RawMerchant }>(
    '/superadmin/merchant-accounts/full-setup-angelpay',
    payload,
  )
  return mapMerchant(data.data)
}

export async function fetchAngelPayAccounts(venueId: string): Promise<AngelPayAccountOption[]> {
  const { data } = await api.get<{
    data: Array<{ id: string; email: string; status: string; environment: string }>
  }>(`/superadmin/venues/${encodeURIComponent(venueId)}/angelpay-accounts`)
  if (!Array.isArray(data?.data)) return []
  return data.data.map((a) => ({
    id: a.id,
    email: a.email,
    status: a.status,
    environment: a.environment,
  }))
}
```

> Verify the `/angelpay-accounts` response shape (read `angelpayUserAccount.controller.ts` `listAngelPayUserAccountsForVenue`) — adapt the map if fields differ.

- [ ] **Step 6: use-merchants.ts append** (import the two + `type AngelPayFullSetupPayload`):

```ts
export function useAngelPayAccounts(venueId: string | undefined) {
  return useQuery({
    queryKey: ['superadmin', 'angelpay-accounts', venueId ?? null],
    queryFn: () => fetchAngelPayAccounts(venueId as string),
    enabled: !!venueId,
    staleTime: 60_000,
  })
}

export function useFullSetupAngelPay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AngelPayFullSetupPayload) => fullSetupAngelPay(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}
```

- [ ] **Step 7:** `npx vitest run src/features/merchants` (Blumon + new AngelPay logic green) + `npx tsc --noEmit` → clean.

---

## Task B2: `AngelPaySetupDrawers` + `AngelPaySetupPanel` + wire + tests

**Files:** Create `src/features/merchants/AngelPaySetupDrawers.tsx`, `AngelPaySetupPanel.tsx`, `AngelPaySetupPanel.test.tsx`; Modify `src/app/router.tsx`, `MerchantsPage.tsx`

- [ ] **Step 1: `AngelPaySetupDrawers.tsx`** — `CuentaDrawer`, `MerchantDrawer`, `SlotDrawer`, `SettlementDrawer` (AngelPay). Use `CardDrawer` from `./SetupDrawerKit`, `Combobox`, `CARD_TYPES`/`humanizeCardType`. Each edits a slice of `AngelPayDraft` and calls `onSave(patch)`.

```tsx
import { useState } from 'react'
import { Combobox } from '@/shared/ui/Combobox'
import { CardDrawer } from './SetupDrawerKit'
import { CARD_TYPES, humanizeCardType } from './types'
import type { AngelPayDraft } from './angelpay-setup'
import type { AngelPayAccountOption } from './api'

const inputCls =
  'h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[14px] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'

export function CuentaDrawer({
  open,
  onOpenChange,
  draft,
  accounts,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draft: AngelPayDraft
  accounts: AngelPayAccountOption[]
  onSave: (
    p: Pick<AngelPayDraft, 'loginMode' | 'angelpayUserAccountId' | 'email' | 'pin' | 'environment'>,
  ) => void
}) {
  const [mode, setMode] = useState(draft.loginMode)
  const [accId, setAccId] = useState(draft.angelpayUserAccountId ?? '')
  const [email, setEmail] = useState(draft.email)
  const [pin, setPin] = useState(draft.pin)
  const [env, setEnv] = useState(draft.environment)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Cuenta AngelPay"
      onSave={() =>
        onSave({
          loginMode: mode,
          angelpayUserAccountId: mode === 'existing' ? accId || null : null,
          email,
          pin,
          environment: env,
        })
      }
    >
      <div className="flex gap-4 text-[13px]">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="ap-login"
            checked={mode === 'new'}
            onChange={() => setMode('new')}
          />{' '}
          Nueva
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="ap-login"
            checked={mode === 'existing'}
            onChange={() => setMode('existing')}
          />{' '}
          Existente
        </label>
      </div>
      {mode === 'existing' ? (
        <div>
          <label className={labelCls}>Cuenta</label>
          <Combobox
            value={accId}
            onChange={setAccId}
            options={accounts.map((a) => ({
              value: a.id,
              label: a.email,
              description: `${a.status} · ${a.environment}`,
            }))}
            ariaLabel="Cuenta AngelPay"
            placeholder="Elige una cuenta"
          />
        </div>
      ) : (
        <>
          <div>
            <label className={labelCls} htmlFor="ap-email">
              Correo
            </label>
            <input
              id="ap-email"
              className={inputCls}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="ap-pin">
              PIN (6 dígitos)
            </label>
            <input
              id="ap-pin"
              className={inputCls}
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="off"
            />
          </div>
          <div>
            <label className={labelCls}>Ambiente</label>
            <Combobox
              value={env}
              onChange={(v) => setEnv(v as AngelPayDraft['environment'])}
              options={[
                { value: 'QA', label: 'QA' },
                { value: 'PROD', label: 'PROD' },
              ]}
              ariaLabel="Ambiente"
            />
          </div>
        </>
      )}
    </CardDrawer>
  )
}

export function MerchantDrawer({
  open,
  onOpenChange,
  draft,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draft: AngelPayDraft
  onSave: (
    p: Pick<AngelPayDraft, 'externalMerchantId' | 'merchantName' | 'affiliation' | 'displayName'>,
  ) => void
}) {
  const [externalMerchantId, setExt] = useState(draft.externalMerchantId)
  const [merchantName, setName] = useState(draft.merchantName)
  const [affiliation, setAff] = useState(draft.affiliation)
  const [displayName, setDisplay] = useState(draft.displayName)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Merchant"
      onSave={() =>
        onSave({
          externalMerchantId: externalMerchantId.trim(),
          merchantName: merchantName.trim(),
          affiliation: affiliation.trim(),
          displayName: displayName.trim(),
        })
      }
    >
      <div>
        <label className={labelCls} htmlFor="ap-ext">
          ID del merchant (numérico)
        </label>
        <input
          id="ap-ext"
          className={inputCls}
          inputMode="numeric"
          value={externalMerchantId}
          onChange={(e) => setExt(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="ap-name">
          Nombre
        </label>
        <input
          id="ap-name"
          className={inputCls}
          value={merchantName}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="ap-aff">
          Afiliación
        </label>
        <input
          id="ap-aff"
          className={inputCls}
          value={affiliation}
          onChange={(e) => setAff(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="ap-disp">
          Nombre visible
        </label>
        <input
          id="ap-disp"
          className={inputCls}
          value={displayName}
          onChange={(e) => setDisplay(e.target.value)}
          placeholder="Cuenta Principal"
        />
      </div>
    </CardDrawer>
  )
}

export function SlotDrawer({
  open,
  onOpenChange,
  draft,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draft: AngelPayDraft
  onSave: (p: Pick<AngelPayDraft, 'accountType' | 'slotMode' | 'replacedAccountId'>) => void
}) {
  const [accountType, setAccountType] = useState(draft.accountType)
  const [slotMode, setSlotMode] = useState(draft.slotMode)
  const [replacedAccountId, setReplaced] = useState(draft.replacedAccountId ?? '')
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Slot"
      onSave={() =>
        onSave({
          accountType,
          slotMode,
          replacedAccountId: slotMode === 'replace' ? replacedAccountId || null : null,
        })
      }
    >
      <div>
        <label className={labelCls}>Slot</label>
        <Combobox
          value={accountType}
          onChange={(v) => setAccountType(v as AngelPayDraft['accountType'])}
          options={[
            { value: 'PRIMARY', label: 'Primary' },
            { value: 'SECONDARY', label: 'Secondary' },
            { value: 'TERTIARY', label: 'Tertiary' },
          ]}
          ariaLabel="Slot"
        />
      </div>
      <div>
        <label className={labelCls}>Modo</label>
        <Combobox
          value={slotMode}
          onChange={(v) => setSlotMode(v as AngelPayDraft['slotMode'])}
          options={[
            { value: 'fill', label: 'Llenar (vacío)' },
            { value: 'replace', label: 'Reemplazar' },
          ]}
          ariaLabel="Modo de slot"
        />
      </div>
      {slotMode === 'replace' && (
        <div>
          <label className={labelCls} htmlFor="ap-rep">
            ID de la cuenta a reemplazar
          </label>
          <input
            id="ap-rep"
            className={inputCls}
            value={replacedAccountId}
            onChange={(e) => setReplaced(e.target.value)}
          />
        </div>
      )}
    </CardDrawer>
  )
}

export function SettlementDrawer({
  open,
  onOpenChange,
  draft,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draft: AngelPayDraft
  onSave: (p: Pick<AngelPayDraft, 'settlement' | 'settlementDayType' | 'cutoffTime'>) => void
}) {
  const [s, setS] = useState(draft.settlement)
  const [dayType, setDayType] = useState(draft.settlementDayType)
  const [cutoff, setCutoff] = useState(draft.cutoffTime)
  const numCls =
    'h-9 w-16 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums'
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Liquidación"
      onSave={() => onSave({ settlement: s, settlementDayType: dayType, cutoffTime: cutoff })}
    >
      {CARD_TYPES.map((c) => (
        <label key={c} className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-[var(--ink-muted)]">{humanizeCardType(c)}</span>
          <span className="inline-flex items-center gap-1 text-[var(--ink-faint)]">
            D+
            <input
              className={numCls}
              inputMode="numeric"
              aria-label={`Días ${humanizeCardType(c)}`}
              value={String(s[c])}
              onChange={(e) => setS({ ...s, [c]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            />
          </span>
        </label>
      ))}
      <div>
        <label className={labelCls}>Tipo de días</label>
        <Combobox
          value={dayType}
          onChange={(v) => setDayType(v as AngelPayDraft['settlementDayType'])}
          options={[
            { value: 'BUSINESS_DAYS', label: 'Hábiles' },
            { value: 'CALENDAR_DAYS', label: 'Naturales' },
          ]}
          ariaLabel="Tipo de días"
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="ap-cut">
          Corte
        </label>
        <input
          id="ap-cut"
          className={`${numCls} w-24`}
          value={cutoff}
          onChange={(e) => setCutoff(e.target.value)}
          placeholder="23:00"
        />
      </div>
    </CardDrawer>
  )
}
```

- [ ] **Step 2: `AngelPaySetupPanel.tsx`** — mirror `BlumonSetupPanel` structure (header X/title/progress/CTA "Activar merchant"; grid de `SetupCard`; estado `AngelPayDraft`; openCard; submit via `useFullSetupAngelPay` + `buildAngelPayPayload`). Required (4): venue, cuenta (loginMode==='existing' ? angelpayUserAccountId : email+pin 6díg), merchant (externalMerchantId+name+affiliation+displayName), slot (always default → but replace requires replacedAccountId). Gating: cuenta gated by venue; merchant gated by cuenta-done; slot gated by venue; cost/pricing/reparto gated by merchant; terminales gated by venue. Cuenta done = existing→accId set, new→email && pin.length===6. Use `useAngelPayAccounts(draft.venueId)` for the existing picker. Cards: Venue, Cuenta AngelPay, Merchant, Slot, Costo (`RatesDrawer`), Precio (`RatesDrawer`), Liquidación (default done), Reparto (optional no editor), Terminales (optional no editor). On submit success → `navigate('/merchants/'+m.id)`. Title "Nuevo merchant AngelPay". Icons: reuse from F5·A (Store, CreditCard, Layers, Landmark, DollarSign, CalendarClock, Split, Tablet) + a wallet-ish icon for Cuenta (e.g. `Wallet`).

  > Mirror `BlumonSetupPanel.tsx` exactly for the shell/grid/drawer-wiring; only the draft, cards, drawers, and `buildAngelPayPayload` differ. Validate: if `slotMode==='replace'` require `replacedAccountId` before enabling submit.

- [ ] **Step 3: Test** `AngelPaySetupPanel.test.tsx`: the `buildAngelPayPayload` unit cases live in `angelpay-setup.test.ts` (B1); here add a render test (MSW `GET /dashboard/superadmin/venues` → `{success,data:[{id:'v1',name:'Doña Simona',slug:'x'}]}`): renders "Nuevo merchant AngelPay" + the 9 cards + CTA disabled initially.

- [ ] **Step 4: Wire.** `router.tsx`: lazy `AngelPaySetupPanel` + `<Route path="/merchants/new-angelpay" element={<AngelPaySetupPanel />} />` (before `/merchants/:id`). `MerchantsPage.tsx`: 3rd button `<Button variant="secondary" onClick={() => navigate('/merchants/new-angelpay')}>+ Alta guiada (AngelPay)</Button>`.

- [ ] **Step 5:** `npx vitest run src/features/merchants` + `npx tsc --noEmit` + `npm run build` → verdes.

---

## Task B3: Server `logAction` + docs + gate

**Files:** Modify `avoqado-server/src/controllers/superadmin/merchantAccount.controller.ts` (if needed); `CHANGELOG.md`

- [ ] **Step 1: Server** — read `fullSetupAngelPayMerchant` (it delegates to `angelpayFullSetup.service`). Check if it (or the service) already writes ActivityLog. If NOT, add at the controller after success: `await logAction({ staffId:(req as any).user?.uid ?? null, action:'MERCHANT_ACCOUNT_PROVISIONED_ANGELPAY', entity:'MerchantAccount', entityId:<created id from the service result>, data:{ venueId: parsed.venueId, accountType: parsed.slot.accountType, loginMode: parsed.login.mode, merchantMode: parsed.merchant.mode }, ipAddress:req.ip, userAgent: req.headers?.['user-agent'] })`. **Never log the PIN.** Optional chaining on user-agent. Only this file (or the service if that's where the id is). `npx tsc --noEmit` clean; report git scope.

- [ ] **Step 2: CHANGELOG** `[Unreleased] · Added`: "Merchant accounts (F5·B): panel de alta guiada AngelPay en `/merchants/new-angelpay` (login existente/nuevo + merchant + slot fill/replace → un POST a full-setup-angelpay); `RatesDrawer`/`CardDrawer` extraídos a `SetupDrawerKit` y reusados por ambos paneles; `logAction` en el full-setup AngelPay."

- [ ] **Step 3: Gate** — `npx prettier --write "src/features/merchants/**/*.{ts,tsx}"` (todo merchants es mío). NO `router.tsx` dir-wide. `npm run check` + `npm run build` → verdes (0 warnings — recuerda: las funciones puras + drawers van en `.ts`/sin mezclar exports; `angelpay-setup.ts` ya separa la lógica). `impeccable:audit` — arreglar ≥ high.

---

## Self-review

- §3 cards → B2 (panel + drawers). §4 DECIMAL+effectiveFrom → B1 (`buildAngelPayPayload` + test asienta 0.025). §5 alcance (create-only, fill/replace) → B1/B2. §6 contratos → B1. §8 logAction → B3.
- Reuse: `SetupCard` (F5·A) ✓; `CardDrawer`+`RatesDrawer` extraídos a `SetupDrawerKit` (B1) ✓; `fetchVenueOptions` (F5·A) ✓.
- Tipos consistentes: `AngelPayDraft`, `AngelPayFullSetupPayload`, `AngelPayAccountOption`, `buildAngelPayPayload`, `INITIAL_ANGELPAY_DRAFT`.
- 0-warnings: `angelpay-setup.ts` (lógica pura) y `SetupDrawerKit.tsx`/drawers (sólo componentes) — sin mezclar exports componente+no-componente (gotcha de F5·A).
- Abierto: `/angelpay-accounts` shape (B1 verifica); logAction puede ir en el service (B3 decide).
