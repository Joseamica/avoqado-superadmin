# Merchant Accounts — F4: Asignación de slots (VenuePaymentConfig) · Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Pantalla venue-céntrica en `/venues/:venueId/merchant` para asignar merchant accounts a los slots primary/secondary/tertiary del venue (`VenuePaymentConfig`) + preferredProcessor, con hint de compatibilidad de hardware.

**Architecture:** Feature `venues`. Page reemplaza el `VenueResourcePlaceholder resource="merchant"`. Data layer local a `venues` (no importa de `merchants`). Editar en sitio (POST/PUT). `routingRules` se preserva pero no se edita. Server gana `logAction` en venuePaymentConfig.

**Tech Stack:** React 18 + TS · TanStack Query · zod · sonner · Combobox/Button/QueryError · Vitest + RTL + MSW.

**Spec:** `docs/superpowers/specs/2026-05-25-merchant-accounts-f4-venue-payment-config-design.md`. **Restricción:** branch `develop`, sin worktree/branch, **sin commit**, sin `npm run format` global. Server aditivo deploy-first.

---

# Parte F4·A — data layer + compat + page + wire

## Task A1: `payment-compat.ts` (puro) — TDD

**Files:** Create `src/features/venues/payment-compat.ts` + `payment-compat.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest'
import { isProviderCompatible } from './payment-compat'

describe('isProviderCompatible', () => {
  it('Blumon requiere PAX', () => {
    expect(isProviderCompatible('BLUMON', ['PAX'])).toBe(true)
    expect(isProviderCompatible('BLUMON', ['NEXGO'])).toBe(false)
  })
  it('AngelPay requiere NEXGO', () => {
    expect(isProviderCompatible('ANGELPAY', ['NEXGO'])).toBe(true)
    expect(isProviderCompatible('ANGELPAY', [])).toBe(false)
  })
  it('proveedor no listado = sin restricción', () => {
    expect(isProviderCompatible('STRIPE', [])).toBe(true)
  })
})
```

- [ ] **Step 2: Correr → FAIL.** `npx vitest run src/features/venues/payment-compat.test.ts`

- [ ] **Step 3: Implementar**

```ts
/** Provider code → brands de terminal compatibles. No listado = sin restricción. */
const PROVIDER_BRANDS: Record<string, string[]> = {
  BLUMON: ['PAX'],
  ANGELPAY: ['NEXGO'],
}

/** ¿El venue (con estos brands de terminal ACTIVO) puede operar este proveedor? */
export function isProviderCompatible(providerCode: string, venueBrands: string[]): boolean {
  const required = PROVIDER_BRANDS[providerCode]
  if (!required?.length) return true
  return venueBrands.some((b) => required.includes(b))
}
```

- [ ] **Step 4: Correr → PASS.** `npx tsc --noEmit`.

---

## Task A2: `venues/api.ts` — config + options + terminal brands

**Files:** Modify `src/features/venues/api.ts`

- [ ] **Step 1: Append** (usa el `api` ya importado):

```ts
/* ─── VenuePaymentConfig (F4) — namespace /superadmin/* ─── */

export type PreferredProcessor = 'AUTO' | 'LEGACY' | 'MENTA' | 'CLIP' | 'BANK_DIRECT'

export interface VenuePaymentConfig {
  primaryAccountId: string
  secondaryAccountId: string | null
  tertiaryAccountId: string | null
  preferredProcessor: PreferredProcessor
  /** JSON opaco — NO se edita en F4, se preserva tal cual en updates. */
  routingRules: unknown
}

export interface MerchantAccountOption {
  id: string
  label: string
  providerCode: string
  providerName: string
  environment: string | null
}

export async function fetchVenuePaymentConfig(venueId: string): Promise<VenuePaymentConfig | null> {
  try {
    const { data } = await api.get<{ data: Record<string, unknown> | null }>(
      `/superadmin/venue-pricing/config/${encodeURIComponent(venueId)}`,
    )
    const c = data?.data
    if (!c) return null
    return {
      primaryAccountId: String(c.primaryAccountId ?? ''),
      secondaryAccountId: (c.secondaryAccountId as string | null) ?? null,
      tertiaryAccountId: (c.tertiaryAccountId as string | null) ?? null,
      preferredProcessor: (c.preferredProcessor as PreferredProcessor) ?? 'AUTO',
      routingRules: c.routingRules ?? null,
    }
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null
    throw error
  }
}

export interface SaveVenuePaymentConfigInput {
  primaryAccountId: string
  secondaryAccountId: string | null
  tertiaryAccountId: string | null
  preferredProcessor: PreferredProcessor
  /** Passthrough del routingRules existente para no borrarlo en el PUT. */
  routingRules?: unknown
}

export async function saveVenuePaymentConfig(
  venueId: string,
  exists: boolean,
  input: SaveVenuePaymentConfigInput,
): Promise<void> {
  if (exists) {
    await api.put(`/superadmin/venue-pricing/config/${encodeURIComponent(venueId)}`, input)
  } else {
    await api.post('/superadmin/venue-pricing/config', { venueId, ...input })
  }
}

export async function fetchMerchantAccountOptions(): Promise<MerchantAccountOption[]> {
  const { data } = await api.get<{
    data: Array<{
      id: string
      displayName: string | null
      alias: string | null
      externalMerchantId: string
      blumonEnvironment: string | null
      provider: { code: string; name: string }
    }>
  }>('/superadmin/merchant-accounts', { params: { active: true } })
  if (!Array.isArray(data?.data)) return []
  return data.data.map((m) => ({
    id: m.id,
    label: m.displayName || m.alias || m.externalMerchantId,
    providerCode: m.provider?.code ?? '',
    providerName: m.provider?.name ?? '—',
    environment: m.blumonEnvironment ?? null,
  }))
}

/** Brands de terminales ACTIVOS del venue (para el hint de compatibilidad). Best-effort. */
export async function fetchVenueTerminalBrands(venueId: string): Promise<string[]> {
  try {
    const { data } = await api.get<{ data: Array<{ brand: string | null; status: string }> }>(
      '/superadmin/terminals',
      { params: { venueId } },
    )
    const rows = Array.isArray(data?.data) ? data.data : []
    return rows
      .filter((t) => t.status === 'ACTIVE' && t.brand)
      .map((t) => (t.brand as string).toUpperCase())
  } catch {
    return [] // degrada a sólo-proveedor si el endpoint no coopera
  }
}
```

> Verifica que `/superadmin/terminals` acepta `?venueId` y devuelve `{ data: [...] }` con `brand`/`status`. Si el shape difiere, ajusta el map; si no filtra por venueId, trae todo y filtra client-side. Si nada coopera, `fetchVenueTerminalBrands` ya degrada a `[]`.

- [ ] **Step 2:** `npx tsc --noEmit` → clean.

---

## Task A3: `venues/use-venues.ts` — hooks

**Files:** Modify `src/features/venues/use-venues.ts`

- [ ] **Step 1:** Importa de `./api`: `fetchVenuePaymentConfig`, `saveVenuePaymentConfig`, `fetchMerchantAccountOptions`, `fetchVenueTerminalBrands`, `type SaveVenuePaymentConfigInput`. Asegura `useMutation`/`useQueryClient` importados de `@tanstack/react-query`. Mira la query key que usa `useVenueDetail` (algo como `['superadmin','venues','detail',id]`) y la de la lista para invalidar.

- [ ] **Step 2: Append**

```ts
export function useVenuePaymentConfig(venueId: string | undefined) {
  return useQuery({
    queryKey: ['superadmin', 'venues', 'payment-config', venueId ?? null],
    queryFn: () => fetchVenuePaymentConfig(venueId as string),
    enabled: !!venueId,
    staleTime: 15_000,
  })
}

export function useMerchantAccountOptions() {
  return useQuery({
    queryKey: ['superadmin', 'merchant-account-options'],
    queryFn: fetchMerchantAccountOptions,
    staleTime: 5 * 60_000,
  })
}

export function useVenueTerminalBrands(venueId: string | undefined) {
  return useQuery({
    queryKey: ['superadmin', 'venues', 'terminal-brands', venueId ?? null],
    queryFn: () => fetchVenueTerminalBrands(venueId as string),
    enabled: !!venueId,
    staleTime: 60_000,
  })
}

export function useSaveVenuePaymentConfig(venueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { exists: boolean; input: SaveVenuePaymentConfigInput }) =>
      saveVenuePaymentConfig(venueId, vars.exists, vars.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'venues', 'payment-config', venueId] })
      qc.invalidateQueries({ queryKey: ['superadmin', 'venues'] }) // refresca detail + lista (SetupIcons)
    },
  })
}
```

> Ajusta los query keys de invalidación a los reales que use `use-venues.ts` (mira `useVenueDetail` / `useVenues`). El objetivo: tras guardar, el detalle del venue y la lista (con sus `SetupIcons`) se refrescan.

- [ ] **Step 3:** `npx tsc --noEmit` → clean.

---

## Task A4: `VenuePaymentConfigPage` + test + wire al router

**Files:** Create `src/features/venues/VenuePaymentConfigPage.tsx` + `VenuePaymentConfigPage.test.tsx`; Modify `src/app/router.tsx`

- [ ] **Step 1: Page.** Lee `venueId` de params; `useVenueDetail`, `useVenuePaymentConfig`, `useMerchantAccountOptions`, `useVenueTerminalBrands`. Form con 3 slots + preferredProcessor + compat hints. Guarda con `useSaveVenuePaymentConfig`.

```tsx
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Combobox } from '@/shared/ui/Combobox'
import { Button } from '@/shared/ui/Button'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  useVenueDetail,
  useVenuePaymentConfig,
  useMerchantAccountOptions,
  useVenueTerminalBrands,
  useSaveVenuePaymentConfig,
} from './use-venues'
import { isProviderCompatible } from './payment-compat'
import type { PreferredProcessor } from './api'

const PROCESSORS: PreferredProcessor[] = ['AUTO', 'LEGACY', 'MENTA', 'CLIP', 'BANK_DIRECT']

export function VenuePaymentConfigPage() {
  const { venueId } = useParams<{ venueId: string }>()
  const navigate = useNavigate()
  const venueQ = useVenueDetail(venueId)
  const configQ = useVenuePaymentConfig(venueId)
  const optionsQ = useMerchantAccountOptions()
  const brandsQ = useVenueTerminalBrands(venueId)
  const save = useSaveVenuePaymentConfig(venueId ?? '')

  const [primary, setPrimary] = useState('')
  const [secondary, setSecondary] = useState('')
  const [tertiary, setTertiary] = useState('')
  const [processor, setProcessor] = useState<PreferredProcessor>('AUTO')
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Hidrata una vez (sin useEffect).
  if (!hydrated && configQ.isSuccess) {
    setHydrated(true)
    const c = configQ.data
    if (c) {
      setPrimary(c.primaryAccountId)
      setSecondary(c.secondaryAccountId ?? '')
      setTertiary(c.tertiaryAccountId ?? '')
      setProcessor(c.preferredProcessor)
    }
  }

  const options = optionsQ.data ?? []
  const brands = brandsQ.data ?? []
  const optById = new Map(options.map((o) => [o.id, o]))

  if (venueQ.isError) {
    return (
      <Shell venueId={venueId}>
        <QueryError
          error={venueQ.error}
          context="cargar el venue"
          onRetry={() => venueQ.refetch()}
        />
      </Shell>
    )
  }

  function validate(): string | null {
    if (!primary) return 'Elige la cuenta principal.'
    if (secondary && secondary === primary)
      return 'La secundaria no puede ser igual a la principal.'
    if (tertiary && (tertiary === primary || tertiary === secondary))
      return 'La terciaria no puede repetir otra cuenta.'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setError(null)
    save.mutate(
      {
        exists: !!configQ.data,
        input: {
          primaryAccountId: primary,
          secondaryAccountId: secondary || null,
          tertiaryAccountId: tertiary || null,
          preferredProcessor: processor,
          routingRules: configQ.data?.routingRules, // passthrough — no lo borramos
        },
      },
      {
        onSuccess: () => {
          toast.success('Configuración de pago guardada')
          navigate(`/venues/${venueId}`)
        },
        onError: (err) => {
          const i = inspectApiError(err, 'guardar la configuración')
          setError(i.description)
          toast.error(i.title, { description: i.description })
        },
      },
    )
  }

  const venue = venueQ.data
  const accountOptions = options.map((o) => ({
    value: o.id,
    label: o.label,
    description: `${o.providerName}${o.environment ? ' · ' + o.environment : ''}`,
  }))
  const optionalOptions = [{ value: '', label: '— ninguno —' }, ...accountOptions]

  return (
    <Shell venueId={venueId}>
      <header className="mt-5">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.025em] text-[var(--ink)] sm:text-[32px]">
          Configurar pagos
        </h1>
        {venue && (
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            para <span className="font-semibold text-[var(--ink)]">{venue.name}</span>
          </p>
        )}
      </header>

      <form onSubmit={handleSubmit} className="mt-8 flex max-w-[560px] flex-col gap-6">
        <Slot
          label="Cuenta principal"
          required
          value={primary}
          onChange={setPrimary}
          options={accountOptions}
          opt={optById.get(primary)}
          brands={brands}
        />
        <Slot
          label="Cuenta secundaria"
          value={secondary}
          onChange={setSecondary}
          options={optionalOptions}
          opt={optById.get(secondary)}
          brands={brands}
        />
        <Slot
          label="Cuenta terciaria"
          value={tertiary}
          onChange={setTertiary}
          options={optionalOptions}
          opt={optById.get(tertiary)}
          brands={brands}
        />
        <div>
          <label className="mb-1 block text-[12px] font-medium text-[var(--ink-muted)]">
            Procesador preferido
          </label>
          <div className="max-w-[240px]">
            <Combobox
              value={processor}
              onChange={(v) => setProcessor(v as PreferredProcessor)}
              options={PROCESSORS.map((p) => ({ value: p, label: p }))}
              ariaLabel="Procesador preferido"
            />
          </div>
        </div>
        {error && (
          <p className="text-[13px] text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Link
            to={`/venues/${venueId}`}
            className="inline-flex h-10 items-center rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-4 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </Shell>
  )
}

function Slot({
  label,
  required,
  value,
  onChange,
  options,
  opt,
  brands,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; description?: string }[]
  opt?: { providerCode: string; providerName: string } | undefined
  brands: string[]
}) {
  const compatible = opt ? isProviderCompatible(opt.providerCode, brands) : true
  return (
    <div>
      <label className="mb-1 block text-[12px] font-medium text-[var(--ink-muted)]">
        {label}
        {required ? ' *' : ''}
      </label>
      <Combobox
        value={value}
        onChange={onChange}
        options={options}
        ariaLabel={label}
        placeholder="Elige una cuenta"
      />
      {opt && (
        <p
          className={`mt-1 inline-flex items-center gap-1 text-[11.5px] ${compatible ? 'text-[var(--ink-faint)]' : 'text-[var(--danger)]'}`}
        >
          {compatible ? (
            <Check className="h-3 w-3" aria-hidden />
          ) : (
            <AlertTriangle className="h-3 w-3" aria-hidden />
          )}
          {opt.providerName}
          {!compatible ? ' — el venue no tiene terminal compatible' : ''}
        </p>
      )}
    </div>
  )
}

function Shell({ venueId, children }: { venueId?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6">
      <Link
        to={`/venues/${venueId ?? ''}`}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Volver al venue
      </Link>
      {children}
    </div>
  )
}
```

> Verifica la firma de `useVenueDetail` (cómo recibe el id) y de `Combobox` (`value/onChange/options/ariaLabel/placeholder`). Ajusta si difiere.

- [ ] **Step 2: Test (MSW).** Mock: `GET /dashboard/superadmin/venues/v1` (envelope `{success,data:{id,name,slug,...}}` — mira `fetchVenueDetail`), `GET /superadmin/venue-pricing/config/v1` → `{ data: { primaryAccountId:'m1', secondaryAccountId:null, tertiaryAccountId:null, preferredProcessor:'AUTO', routingRules:null } }`, `GET /superadmin/merchant-accounts` → `{ data: [{ id:'m1', displayName:'Cuenta A', alias:null, externalMerchantId:'9814', blumonEnvironment:'SANDBOX', provider:{code:'BLUMON',name:'Blumon'} }, { id:'m2', displayName:'Cuenta B', alias:null, externalMerchantId:'8842', blumonEnvironment:null, provider:{code:'ANGELPAY',name:'AngelPay'} }] }`, `GET /superadmin/terminals` → `{ data: [] }`, `PUT /superadmin/venue-pricing/config/v1` → capturar body. Render dentro de `<Routes><Route path="/venues/:venueId/merchant" element={<VenuePaymentConfigPage/>}/></Routes>` con `initialEntries:['/venues/v1/merchant']`. Espera que cargue "Cuenta A", submit "Guardar", **assert el PUT con `primaryAccountId:'m1'`**. (Para cambiar el primary vía cmdk Combobox es engorroso; basta con verificar que el valor cargado se reenvía. Opcional: un 2º test que valida "secundaria == principal" muestra error sin request.)

- [ ] **Step 3: Router.** En `src/app/router.tsx`: agrega `const VenuePaymentConfigPage = lazy(() => import('@/features/venues/VenuePaymentConfigPage').then((m) => ({ default: m.VenuePaymentConfigPage })))`. Reemplaza el element de la ruta `/venues/:venueId/merchant` (hoy `<VenueResourcePlaceholder resource="merchant" />`) por `<VenuePaymentConfigPage />`. Deja los otros placeholders (owner/kyc/terminals/pricing) intactos.

- [ ] **Step 4:** `npx vitest run src/features/venues` + `npx tsc --noEmit` + `npm run build` → verdes.

---

# Parte F4·B — server logAction + gate

## Task B1: Server `logAction` en venuePaymentConfig

**Files:** Modify `avoqado-server/src/controllers/superadmin/venuePricing.controller.ts`

> Aditivo, sin commit, deploy-first. Sólo ese archivo (ya tiene `logAction` importado de F2 — reúsalo).

- [ ] **Step 1:** En `createVenuePaymentConfig` y `updateVenuePaymentConfig`:

```ts
await logAction({
  staffId: (req as any).user?.uid ?? null,
  action: 'VENUE_PAYMENT_CONFIG_CREATED', // _UPDATED en update
  entity: 'VenuePaymentConfig',
  entityId: venueId, // en create viene de req.body.venueId; en update de req.params.venueId
  data: { venueId, primaryAccountId, secondaryAccountId, tertiaryAccountId, preferredProcessor },
  ipAddress: req.ip,
  userAgent: req.headers?.['user-agent'], // optional chaining (gotcha F1B-F3)
})
```

Si `logAction` no estaba importado en este archivo, agrégalo: `import { logAction } from '../../services/dashboard/activity-log.service'`.

- [ ] **Step 2:** `cd avoqado-server && npx tsc --noEmit` → clean. `git status --porcelain` → sólo ese archivo nuevo en el set. No commit.

---

## Task B2: Docs + gate

**Files:** Modify `CHANGELOG.md`

- [ ] **Step 1:** CHANGELOG `[Unreleased] · Added`: "Merchant accounts (F4): pantalla venue-céntrica `/venues/:id/merchant` para asignar cuentas a los slots primary/secondary/tertiary + preferredProcessor (con hint de compatibilidad de hardware); `logAction` en venuePaymentConfig."
- [ ] **Step 2:** `npx prettier --write "src/features/venues/**/*.{ts,tsx}"`. `npm run check` + `npm run build` → verdes.
- [ ] **Step 3:** `impeccable:audit` — arreglar ≥ high.

---

## Self-review

- §2 slots → A4 (page); preferredProcessor → A4; compat hint → A1 + A4; logAction → B1. §3 editar-en-sitio → A2 (`saveVenuePaymentConfig`); selector local → A2 (`fetchMerchantAccountOptions`); routing preservado → A4 (passthrough `routingRules`). §4 contratos → A2. §6 UI → A4. §8 tests → A1/A4.
- Tipos consistentes: `VenuePaymentConfig`, `SaveVenuePaymentConfigInput`, `MerchantAccountOption`, `PreferredProcessor`, `isProviderCompatible`.
- Abiertos (§9): `?venueId` en `/superadmin/terminals` (A2 degrada si falla); query keys reales de invalidación (A3 nota); `routingRules` en update (A4 lo reenvía como passthrough).
