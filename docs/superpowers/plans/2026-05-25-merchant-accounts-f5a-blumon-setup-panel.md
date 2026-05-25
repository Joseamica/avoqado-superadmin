# Merchant Accounts — F5·A: Panel de alta Blumon · Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Panel full-screen de alta de merchant Blumon (`/merchants/new`) — grid de cards de estado con gating + progreso + CTA "Crear merchant" → un POST a `blumon/full-setup`.

**Architecture:** Feature `merchants`. Estado local `draft` en el panel; cada card abre un `Drawer` que edita su slice; el CTA ensambla el body (tasas ×100) y hace un POST. `SetupCard` es un primitive nuevo (template para F5·B AngelPay).

**Tech Stack:** React 18 + TS · TanStack Query · sonner · Drawer/Combobox/Button/Badge · `CardRatesInput` (F2) · Vitest + RTL + MSW.

**Spec:** `docs/superpowers/specs/2026-05-25-merchant-accounts-f5a-blumon-setup-panel-design.md`. **Restricción:** branch `develop`, sin worktree/branch, **sin commit**, sin `npm run format` global. Server aditivo deploy-first. **Three-Level Rule:** drawers en UN archivo `BlumonSetupDrawers.tsx` (no subdir).

---

## Task A1: api + hooks (`fullSetupBlumon`, `fetchVenueOptions`)

**Files:** Modify `src/features/merchants/api.ts`, `use-merchants.ts`

- [ ] **Step 1: api.ts append**

```ts
/* ─── Blumon full-setup (F5·A) ─── */

export interface VenueOption {
  id: string
  name: string
  slug: string
}

/** Tasas EN PORCENTAJE (el endpoint full-setup divide /100). NO decimal. */
export interface BlumonRateOverride {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax: boolean
  fixedCostPerTransaction?: number
  monthlyFee?: number
}
export interface BlumonPricingOverride {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax: boolean
  fixedFeePerTransaction?: number
  monthlyServiceFee?: number
}

export interface BlumonFullSetupPayload {
  serialNumber: string
  brand: string
  model: string
  displayName?: string
  environment: 'SANDBOX' | 'PRODUCTION'
  businessCategory?: string
  target: { type: 'venue'; id: string }
  accountSlot: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  additionalTerminalIds?: string[]
  costStructureOverrides?: BlumonRateOverride
  venuePricing?: BlumonPricingOverride
  settlementConfig?: {
    debitDays: number
    creditDays: number
    amexDays: number
    internationalDays: number
  }
}

export async function fullSetupBlumon(payload: BlumonFullSetupPayload): Promise<MerchantAccount> {
  const { data } = await api.post<{ data: RawMerchant }>(
    '/superadmin/merchant-accounts/blumon/full-setup',
    payload,
  )
  return mapMerchant(data.data)
}

export async function fetchVenueOptions(): Promise<VenueOption[]> {
  // Venues viven en el namespace legacy (envelope {success,data}); merchants-local fetch.
  const { data } = await api.get<{ data: Array<{ id: string; name: string; slug: string }> }>(
    '/dashboard/superadmin/venues',
  )
  if (!Array.isArray(data?.data)) return []
  return data.data.map((v) => ({ id: v.id, name: v.name, slug: v.slug }))
}
```

- [ ] **Step 2: use-merchants.ts append** (import `fullSetupBlumon`, `fetchVenueOptions`, `type BlumonFullSetupPayload`):

```ts
export function useVenueOptions() {
  return useQuery({
    queryKey: ['superadmin', 'venue-options'],
    queryFn: fetchVenueOptions,
    staleTime: 5 * 60_000,
  })
}

export function useFullSetupBlumon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BlumonFullSetupPayload) => fullSetupBlumon(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}
```

- [ ] **Step 3:** `npx tsc --noEmit` → clean.

---

## Task A2: `SetupCard` primitive + test

**Files:** Create `src/features/merchants/SetupCard.tsx` + `SetupCard.test.tsx`

- [ ] **Step 1: Component**

```tsx
import type { LucideIcon } from 'lucide-react'
import { Check, Lock } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/utils'

export type SetupCardState = 'pending' | 'done' | 'locked'

interface SetupCardProps {
  icon: LucideIcon
  title: string
  description: string
  state: SetupCardState
  /** Texto del badge cuando locked (ej. "Selecciona el venue primero"). */
  lockedReason?: string
  /** Etiqueta del badge "done" (ej. "Doña Simona", "T+1/1/3/3"). */
  doneLabel?: string
  optional?: boolean
  onClick?: () => void
}

export function SetupCard({
  icon: Icon,
  title,
  description,
  state,
  lockedReason,
  doneLabel,
  optional,
  onClick,
}: SetupCardProps) {
  const disabled = state === 'locked' || !onClick
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-2 rounded-[10px] border p-5 text-left transition-colors',
        state === 'locked'
          ? 'cursor-not-allowed border-dashed border-[var(--line)] opacity-60'
          : 'border-[var(--line-strong)] bg-[var(--canvas)] hover:border-[var(--accent-line)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden />
          <span className="text-[14px] font-semibold text-[var(--ink)]">{title}</span>
        </div>
        {state === 'done' ? (
          <Badge tone="success" size="sm">
            <Check className="h-3 w-3" aria-hidden /> {doneLabel ?? 'Listo'}
          </Badge>
        ) : state === 'locked' ? (
          <Badge tone="muted" size="sm">
            <Lock className="h-3 w-3" aria-hidden /> {lockedReason ?? 'Bloqueado'}
          </Badge>
        ) : (
          <Badge tone={optional ? 'muted' : 'warn'} size="sm">
            {optional ? 'Opcional' : 'Pendiente'}
          </Badge>
        )}
      </div>
      <p className="text-[12.5px] text-[var(--ink-muted)]">{description}</p>
    </button>
  )
}
```

- [ ] **Step 2: Test** `SetupCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreditCard } from 'lucide-react'
import { SetupCard } from './SetupCard'

describe('SetupCard', () => {
  it('done muestra doneLabel y es clickable', () => {
    const onClick = vi.fn()
    render(
      <SetupCard
        icon={CreditCard}
        title="Venue"
        description="x"
        state="done"
        doneLabel="Doña Simona"
        onClick={onClick}
      />,
    )
    expect(screen.getByText('Doña Simona')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
  it('locked no dispara onClick', () => {
    const onClick = vi.fn()
    render(
      <SetupCard
        icon={CreditCard}
        title="Slot"
        description="x"
        state="locked"
        lockedReason="Selecciona venue"
        onClick={onClick}
      />,
    )
    expect(screen.getByText('Selecciona venue')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3:** `npx vitest run src/features/merchants/SetupCard.test.tsx` → pass. `npx tsc --noEmit`.

---

## Task A3: Card drawers (`BlumonSetupDrawers.tsx`)

**Files:** Create `src/features/merchants/BlumonSetupDrawers.tsx`

Define the shared draft type + 7 small drawer components (one file, Three-Level Rule). Each drawer edits a local copy and calls `onSave(patch)` then closes.

- [ ] **Step 1: Create the file**

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
import { Combobox } from '@/shared/ui/Combobox'
import { CardRatesInput } from './CardRatesInput'
import { CARD_TYPES, humanizeCardType, type CardRates } from './types'
import type { VenueOption } from './api'

export interface BlumonDraft {
  venueId: string | null
  venueName: string | null
  serialNumber: string
  brand: string
  model: string
  environment: 'SANDBOX' | 'PRODUCTION'
  displayName: string
  businessCategory: string
  accountSlot: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  cost: CardRates | null
  costIncludesTax: boolean
  pricing: CardRates | null
  pricingIncludesTax: boolean
  settlement: { DEBIT: number; CREDIT: number; AMEX: number; INTERNATIONAL: number }
}

export const ZERO_RATES: CardRates = { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 }
export const INITIAL_DRAFT: BlumonDraft = {
  venueId: null,
  venueName: null,
  serialNumber: '',
  brand: 'PAX',
  model: 'A910S',
  environment: 'SANDBOX',
  displayName: '',
  businessCategory: '',
  accountSlot: 'PRIMARY',
  cost: null,
  costIncludesTax: true,
  pricing: null,
  pricingIncludesTax: true,
  settlement: { DEBIT: 1, CREDIT: 1, AMEX: 3, INTERNATIONAL: 3 },
}

const inputCls =
  'h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[14px] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'

function CardDrawer({
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

export function VenueDrawer({
  open,
  onOpenChange,
  venues,
  value,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  venues: VenueOption[]
  value: string | null
  onSave: (p: Pick<BlumonDraft, 'venueId' | 'venueName'>) => void
}) {
  const [id, setId] = useState(value ?? '')
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Venue"
      onSave={() => {
        const v = venues.find((x) => x.id === id)
        onSave({ venueId: id || null, venueName: v?.name ?? null })
      }}
    >
      <div>
        <label className={labelCls}>Venue</label>
        <Combobox
          value={id}
          onChange={setId}
          options={venues.map((v) => ({ value: v.id, label: v.name, description: v.slug }))}
          ariaLabel="Venue"
          placeholder="Selecciona el venue"
        />
      </div>
    </CardDrawer>
  )
}

export function HardwareDrawer({
  open,
  onOpenChange,
  draft,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draft: BlumonDraft
  onSave: (p: Pick<BlumonDraft, 'serialNumber' | 'brand' | 'model' | 'environment'>) => void
}) {
  const [serial, setSerial] = useState(draft.serialNumber)
  const [brand, setBrand] = useState(draft.brand)
  const [model, setModel] = useState(draft.model)
  const [env, setEnv] = useState(draft.environment)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Terminal Blumon"
      onSave={() => onSave({ serialNumber: serial.trim(), brand, model, environment: env })}
    >
      <div>
        <label className={labelCls} htmlFor="serial">
          Serial
        </label>
        <input
          id="serial"
          className={inputCls}
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls}>Marca</label>
        <Combobox
          value={brand}
          onChange={setBrand}
          options={[
            { value: 'PAX', label: 'PAX' },
            { value: 'NEXGO', label: 'NEXGO' },
          ]}
          ariaLabel="Marca"
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="model">
          Modelo
        </label>
        <input
          id="model"
          className={inputCls}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="A910S"
        />
      </div>
      <div>
        <label className={labelCls}>Ambiente</label>
        <Combobox
          value={env}
          onChange={(v) => setEnv(v as BlumonDraft['environment'])}
          options={[
            { value: 'SANDBOX', label: 'Sandbox' },
            { value: 'PRODUCTION', label: 'Producción' },
          ]}
          ariaLabel="Ambiente"
        />
      </div>
      <p className="text-[11.5px] text-[var(--ink-faint)]">
        El server obtiene las credenciales (OAuth/DUKPT) de Blumon con este serial.
      </p>
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
  draft: BlumonDraft
  onSave: (p: Pick<BlumonDraft, 'displayName' | 'businessCategory'>) => void
}) {
  const [displayName, setDisplayName] = useState(draft.displayName)
  const [businessCategory, setBusinessCategory] = useState(draft.businessCategory)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Merchant"
      onSave={() =>
        onSave({ displayName: displayName.trim(), businessCategory: businessCategory.trim() })
      }
    >
      <div>
        <label className={labelCls} htmlFor="dn">
          Nombre visible
        </label>
        <input
          id="dn"
          className={inputCls}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Cuenta Principal"
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="bc">
          Categoría de negocio (opcional)
        </label>
        <input
          id="bc"
          className={inputCls}
          value={businessCategory}
          onChange={(e) => setBusinessCategory(e.target.value)}
          placeholder="restaurant"
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
  draft: BlumonDraft
  onSave: (p: Pick<BlumonDraft, 'accountSlot'>) => void
}) {
  const [slot, setSlot] = useState(draft.accountSlot)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Slot"
      onSave={() => onSave({ accountSlot: slot })}
    >
      <div>
        <label className={labelCls}>Slot de ruteo</label>
        <Combobox
          value={slot}
          onChange={(v) => setSlot(v as BlumonDraft['accountSlot'])}
          options={[
            { value: 'PRIMARY', label: 'Primary' },
            { value: 'SECONDARY', label: 'Secondary' },
            { value: 'TERTIARY', label: 'Tertiary' },
          ]}
          ariaLabel="Slot"
        />
      </div>
    </CardDrawer>
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
      <CardRatesInput value={rates} onChange={setRates} idPrefix="f5rate" />
      <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
        <input type="checkbox" checked={tax} onChange={(e) => setTax(e.target.checked)} /> Las tasas
        ya incluyen IVA
      </label>
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
  draft: BlumonDraft
  onSave: (s: BlumonDraft['settlement']) => void
}) {
  const [s, setS] = useState(draft.settlement)
  const numCls =
    'h-9 w-16 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums'
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Liquidación"
      onSave={() => onSave(s)}
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
    </CardDrawer>
  )
}
```

- [ ] **Step 2:** `npx tsc --noEmit` → clean.

---

## Task A4: `BlumonSetupPanel` + submit + wire + tests

**Files:** Create `src/features/merchants/BlumonSetupPanel.tsx` + `BlumonSetupPanel.test.tsx`; Modify `src/app/router.tsx`, `src/features/merchants/MerchantsPage.tsx`

- [ ] **Step 1: Panel** (`BlumonSetupPanel.tsx`)

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Store,
  Smartphone,
  CreditCard,
  Layers,
  Landmark,
  DollarSign,
  CalendarClock,
  Split,
  Tablet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { inspectApiError } from '@/shared/lib/api-error'
import { SetupCard, type SetupCardState } from './SetupCard'
import { useVenueOptions, useFullSetupBlumon } from './use-merchants'
import {
  VenueDrawer,
  HardwareDrawer,
  MerchantDrawer,
  SlotDrawer,
  RatesDrawer,
  SettlementDrawer,
  INITIAL_DRAFT,
  type BlumonDraft,
} from './BlumonSetupDrawers'
import type { BlumonFullSetupPayload } from './api'

type CardKey =
  | 'venue'
  | 'hardware'
  | 'merchant'
  | 'slot'
  | 'cost'
  | 'pricing'
  | 'settlement'
  | 'revenue'
  | 'terminals'
const toPct = (d: number) => Math.round(d * 10000) / 100 // decimal → %

export function BlumonSetupPanel() {
  const navigate = useNavigate()
  const venuesQ = useVenueOptions()
  const submit = useFullSetupBlumon()
  const [draft, setDraft] = useState<BlumonDraft>(INITIAL_DRAFT)
  const [openCard, setOpenCard] = useState<CardKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const patch = (p: Partial<BlumonDraft>) => setDraft((d) => ({ ...d, ...p }))

  // Estado por card (computado en render)
  const venueDone = !!draft.venueId
  const hardwareDone = !!(draft.serialNumber && draft.brand && draft.model)
  const merchantDone = !!draft.displayName
  const required = { venue: venueDone, hardware: hardwareDone, merchant: merchantDone, slot: true } // slot default PRIMARY = listo
  const requiredDone = Object.values(required).filter(Boolean).length
  const canSubmit = venueDone && hardwareDone && merchantDone

  function status(done: boolean, locked: boolean, optional = false): SetupCardState {
    if (locked) return 'locked'
    return done ? 'done' : optional ? 'pending' : 'pending'
  }

  function handleSubmit() {
    setError(null)
    const payload: BlumonFullSetupPayload = {
      serialNumber: draft.serialNumber,
      brand: draft.brand,
      model: draft.model,
      displayName: draft.displayName || undefined,
      environment: draft.environment,
      businessCategory: draft.businessCategory || undefined,
      target: { type: 'venue', id: draft.venueId as string },
      accountSlot: draft.accountSlot,
      additionalTerminalIds: [],
      ...(draft.cost && {
        costStructureOverrides: {
          debitRate: toPct(draft.cost.DEBIT),
          creditRate: toPct(draft.cost.CREDIT),
          amexRate: toPct(draft.cost.AMEX),
          internationalRate: toPct(draft.cost.INTERNATIONAL),
          includesTax: draft.costIncludesTax,
        },
      }),
      ...(draft.pricing && {
        venuePricing: {
          debitRate: toPct(draft.pricing.DEBIT),
          creditRate: toPct(draft.pricing.CREDIT),
          amexRate: toPct(draft.pricing.AMEX),
          internationalRate: toPct(draft.pricing.INTERNATIONAL),
          includesTax: draft.pricingIncludesTax,
        },
      }),
      settlementConfig: {
        debitDays: draft.settlement.DEBIT,
        creditDays: draft.settlement.CREDIT,
        amexDays: draft.settlement.AMEX,
        internationalDays: draft.settlement.INTERNATIONAL,
      },
    }
    submit.mutate(payload, {
      onSuccess: (m) => {
        toast.success('Merchant Blumon creado')
        navigate(`/merchants/${m.id}`)
      },
      onError: (err) => {
        const i = inspectApiError(err, 'crear el merchant')
        setError(i.description)
        toast.error(i.title, { description: i.description })
      },
    })
  }

  const venues = venuesQ.data ?? []

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--canvas)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-3">
        <IconButton size="md" aria-label="Cerrar" onClick={() => navigate('/merchants')}>
          <X className="h-4 w-4" aria-hidden />
        </IconButton>
        <h1 className="font-display text-[16px] font-semibold text-[var(--ink)]">
          Nuevo merchant Blumon
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[var(--ink-muted)] tabular-nums">
            {requiredDone} de 4 obligatorios
          </span>
          <Button size="sm" disabled={!canSubmit || submit.isPending} onClick={handleSubmit}>
            {submit.isPending ? 'Creando…' : 'Crear merchant'}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        {error && (
          <p className="mb-4 text-[13px] text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SetupCard
            icon={Store}
            title="Venue"
            description={draft.venueName ?? 'Selecciona el venue'}
            state={status(venueDone, false)}
            doneLabel={draft.venueName ?? undefined}
            onClick={() => setOpenCard('venue')}
          />
          <SetupCard
            icon={Smartphone}
            title="Terminal Blumon"
            description={
              hardwareDone
                ? `${draft.brand} ${draft.model} · ${draft.serialNumber}`
                : 'Serial + hardware (auto-fetch de credenciales)'
            }
            state={status(hardwareDone, false)}
            doneLabel={hardwareDone ? draft.serialNumber : undefined}
            onClick={() => setOpenCard('hardware')}
          />
          <SetupCard
            icon={CreditCard}
            title="Merchant"
            description={merchantDone ? draft.displayName : 'Nombre de la cuenta a crear'}
            state={status(merchantDone, !hardwareDone)}
            lockedReason="Configura el terminal primero"
            doneLabel={merchantDone ? draft.displayName : undefined}
            onClick={() => setOpenCard('merchant')}
          />
          <SetupCard
            icon={Layers}
            title="Slot"
            description={`Slot de ruteo · ${draft.accountSlot}`}
            state={status(true, !venueDone)}
            lockedReason="Selecciona el venue primero"
            doneLabel={draft.accountSlot}
            onClick={() => setOpenCard('slot')}
          />
          <SetupCard
            icon={Landmark}
            title="Costo del procesador"
            description={draft.cost ? 'Configurado' : 'Opcional — lo que Blumon nos cobra'}
            state={status(!!draft.cost, !merchantDone, true)}
            lockedReason="Configura el merchant primero"
            optional
            onClick={() => setOpenCard('cost')}
          />
          <SetupCard
            icon={DollarSign}
            title="Precio al venue"
            description={
              draft.pricing ? 'Configurado' : 'Opcional — lo que Avoqado le cobra al venue'
            }
            state={status(!!draft.pricing, !merchantDone, true)}
            lockedReason="Configura el merchant primero"
            optional
            onClick={() => setOpenCard('pricing')}
          />
          <SetupCard
            icon={CalendarClock}
            title="Liquidación"
            description={`T+${draft.settlement.DEBIT}/${draft.settlement.CREDIT}/${draft.settlement.AMEX}/${draft.settlement.INTERNATIONAL} · días hábiles`}
            state="done"
            doneLabel="Listo"
            onClick={() => setOpenCard('settlement')}
          />
          <SetupCard
            icon={Split}
            title="Reparto de ganancias"
            description="Opcional — usa el default (100% Avoqado); configúralo después"
            state={status(false, !merchantDone, true)}
            lockedReason="Configura el merchant primero"
            optional
          />
          <SetupCard
            icon={Tablet}
            title="Terminales TPV"
            description="Se atan por serial; agrega extra desde el detalle"
            state={status(false, !venueDone, true)}
            lockedReason="Selecciona el venue primero"
            optional
          />
        </div>
      </div>

      {openCard === 'venue' && (
        <VenueDrawer
          open
          onOpenChange={() => setOpenCard(null)}
          venues={venues}
          value={draft.venueId}
          onSave={patch}
        />
      )}
      {openCard === 'hardware' && (
        <HardwareDrawer open onOpenChange={() => setOpenCard(null)} draft={draft} onSave={patch} />
      )}
      {openCard === 'merchant' && (
        <MerchantDrawer open onOpenChange={() => setOpenCard(null)} draft={draft} onSave={patch} />
      )}
      {openCard === 'slot' && (
        <SlotDrawer open onOpenChange={() => setOpenCard(null)} draft={draft} onSave={patch} />
      )}
      {openCard === 'cost' && (
        <RatesDrawer
          open
          onOpenChange={() => setOpenCard(null)}
          title="Costo del procesador"
          value={draft.cost}
          includesTax={draft.costIncludesTax}
          onSave={(rates, includesTax) => patch({ cost: rates, costIncludesTax: includesTax })}
        />
      )}
      {openCard === 'pricing' && (
        <RatesDrawer
          open
          onOpenChange={() => setOpenCard(null)}
          title="Precio al venue"
          value={draft.pricing}
          includesTax={draft.pricingIncludesTax}
          onSave={(rates, includesTax) =>
            patch({ pricing: rates, pricingIncludesTax: includesTax })
          }
        />
      )}
      {openCard === 'settlement' && (
        <SettlementDrawer
          open
          onOpenChange={() => setOpenCard(null)}
          draft={draft}
          onSave={(s) => patch({ settlement: s })}
        />
      )}
    </div>
  )
}
```

> Verifica nombres de iconos lucide (`CalendarClock`, `Split`, `Tablet`, etc.) — si alguno no existe en la versión instalada, sustituye por uno cercano. Confirma firma de `IconButton`.

- [ ] **Step 2: Router + button.**
  - `router.tsx`: `const BlumonSetupPanel = lazy(() => import('@/features/merchants/BlumonSetupPanel').then((m) => ({ default: m.BlumonSetupPanel })))`. Ruta `<Route path="/merchants/new" element={<BlumonSetupPanel />} />` **ANTES** de `/merchants/:id`.
  - `MerchantsPage.tsx`: agrega un 2º botón en el header `<Button variant="secondary" onClick={() => navigate('/merchants/new')}>+ Alta guiada (Blumon)</Button>` (junto al "+ Alta manual" de F1·B; importa `useNavigate` si falta).

- [ ] **Step 3: Test (MSW)** `BlumonSetupPanel.test.tsx`: MSW `GET /dashboard/superadmin/venues` → `{ success:true, data:[{id:'v1',name:'Doña Simona',slug:'dona-simona'}] }`; `POST /superadmin/merchant-accounts/blumon/full-setup` → capturar body, devolver `{ data: { id:'m1', provider:{id:'p',code:'BLUMON',name:'Blumon',type:'PAYMENT_PROCESSOR'}, externalMerchantId:'blumon_x', alias:null, displayName:'Cuenta', active:true, displayOrder:0, clabeNumber:null,bankName:null,accountHolder:null, hasCredentials:true, blumonSerialNumber:'2841',blumonPosId:null,blumonEnvironment:'SANDBOX',blumonMerchantId:null, angelpayAffiliation:null,angelpayMerchantName:null,aggregatorId:null, venues:[],terminals:[], _count:{costStructures:0,venueConfigs:0,terminals:0}, createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z' } }`. Render `<BlumonSetupPanel/>` con `renderWithProviders`. Flujo: abrir card Venue → elegir (o setear vía el drawer; si cmdk es engorroso, exporta un helper o testea el estado mínimo) … **realista:** dado lo engorroso del Combobox cmdk en jsdom, el test puede: (a) verificar que "Crear merchant" arranca deshabilitado; (b) un test del **toPct**/ensamble si se extrae a función pura. **Extrae `buildBlumonPayload(draft)` como función pura exportada** y testéala: draft con cost 0.025 → `costStructureOverrides.debitRate === 2.5`. Más un render test (título "Nuevo merchant Blumon", 9 cards).
  - **Refactor para testabilidad:** mueve el ensamble del payload a `buildBlumonPayload(draft): BlumonFullSetupPayload` (exportada desde el panel o `BlumonSetupDrawers.tsx`), y que `handleSubmit` la use. Test directo de la conversión %.

- [ ] **Step 4:** `npx vitest run src/features/merchants` + `npx tsc --noEmit` + `npm run build` → verdes.

---

## Task A5: Server `logAction` + docs + gate

**Files:** Modify `avoqado-server/src/controllers/superadmin/merchantAccount.controller.ts`; `CHANGELOG.md`

- [ ] **Step 1: Server** — en `fullSetupBlumonMerchant`, tras crear (cuando `merchantAccountId` está resuelto, antes del `res.status(201)`), agregar:

```ts
await logAction({
  staffId: (req as any).user?.uid ?? null,
  action: 'MERCHANT_ACCOUNT_PROVISIONED_BLUMON',
  entity: 'MerchantAccount',
  entityId: merchantAccountId,
  data: { venueId: target?.id, serialNumber, accountSlot, environment, merchantCreated },
  ipAddress: req.ip,
  userAgent: req.headers?.['user-agent'],
})
```

(`logAction` ya está importado en este controller desde F1·B. **Optional chaining** en user-agent.) Sólo este archivo, sin commit. `npx tsc --noEmit` clean.

- [ ] **Step 2: CHANGELOG** `[Unreleased] · Added`: "Merchant accounts (F5·A): panel de alta guiada Blumon en `/merchants/new` (cards de estado con gating + progreso → un POST a blumon/full-setup con auto-fetch de credenciales); `logAction` en el full-setup."

- [ ] **Step 3: Gate** — `npx prettier --write` SÓLO los archivos nuevos de F5·A (`SetupCard.tsx`, `SetupCard.test.tsx`, `BlumonSetupDrawers.tsx`, `BlumonSetupPanel.tsx`, `BlumonSetupPanel.test.tsx`) — NO `api.ts`/`use-merchants.ts`/`router.tsx`/`MerchantsPage.tsx` dir-wide (mis appends ahí ya van limpios; pero sí puedes prettier los 2 de merchants que son 100% míos: api.ts/use-merchants.ts son del feature merchants 100% mío → OK prettier; router.tsx y MerchantsPage.tsx también son míos en su mayoría pero router.tsx tiene trabajo del usuario — NO lo toques dir-wide). Mejor: prettier sólo los 5 archivos nuevos listados. Luego `npm run check` + `npm run build` → verdes. Si lint marca mis líneas en router/MerchantsPage, arregla esas líneas puntuales.
- [ ] **Step 4:** `impeccable:audit` — arreglar ≥ high.

---

## Self-review

- §2 panel + §3 cards → A2 (SetupCard) + A3 (drawers) + A4 (panel/grid/gating/submit). §4 % → A4 (`toPct` + buildBlumonPayload test). §5 contratos → A1. §9 logAction → A5.
- Obligatorias=4 (venue/hardware/merchant/slot) → A4 `requiredDone`/`canSubmit`. Reparto/Terminales = cards sin editor (A4, optional, no onClick).
- Tipos consistentes: `BlumonDraft`, `BlumonFullSetupPayload`, `BlumonRateOverride`, `VenueOption`, `SetupCardState`, `buildBlumonPayload`.
- Three-Level Rule: drawers en un solo `BlumonSetupDrawers.tsx` (no subdir). Abiertos (§11): iconos lucide (A4 verifica), settlementConfig dayType/cutoff (server defaults).
