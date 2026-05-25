# Merchant Accounts — F3: Liquidación editable + proyección · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Editar `SettlementConfiguration` por tarjeta desde el detalle del merchant + mostrar un estimado de fecha de depósito (días hábiles excluyendo feriados de `date.nager.at`, cacheados en `HolidayCalendar` por un endpoint nuevo del server).

**Architecture:** Frontend extiende `src/features/merchants/` con `settlement.ts` (proyección pura), un drawer y api/hooks; el server gana un endpoint `GET /superadmin/holidays` que proxea Nager + upserta `HolidayCalendar`. Editar en sitio (PUT activa / POST si no existe). Proyección 100% client-side usando los feriados del endpoint.

**Tech Stack:** React 18 + TS · TanStack Query · zod · sonner · Drawer/Combobox/Button · Vitest + RTL + MSW. Server: Express + Prisma.

**Spec:** `docs/superpowers/specs/2026-05-25-merchant-accounts-f3-settlement-design.md`. **Restricción:** branch `develop`, sin worktree/branch, **sin commit**, sin `npm run format` global. Cambios de server **aditivos, sin commit, deploy-first**.

---

# Parte F3·A — Server holidays + lógica + data layer

## Task A1: Server — endpoint `GET /superadmin/holidays` (avoqado-server)

**Files:** Create `avoqado-server/src/controllers/superadmin/holidays.controller.ts` + `avoqado-server/src/routes/superadmin/holidays.routes.ts`; Modify `avoqado-server/src/routes/superadmin.routes.ts`

> Aditivo, **sin commit**, deploy-first. Edita sólo estos archivos del server.

- [ ] **Step 1: Verificar convenciones del server.** Determina (a) cómo hace HTTP saliente el server (busca `import axios` o uso de `fetch`); (b) el nombre del compound unique de `HolidayCalendar` para el upsert (en `schema.prisma` es `@@unique([date, holidayType])` → Prisma lo expone como `date_holidayType`); (c) el patrón de controller/route (mira `aggregator.controller.ts` + `aggregator.routes.ts`). Usa el cliente Prisma como los demás controllers (`import prisma from '@/utils/prismaClient'` o el path que usen).

- [ ] **Step 2: Controller** `holidays.controller.ts`:

```ts
import { Request, Response, NextFunction } from 'express'
import prisma from '@/utils/prismaClient'
import { BadRequestError } from '../../errors/AppError'

interface NagerHoliday {
  date: string
  localName: string
  name: string
}

/**
 * GET /api/v1/superadmin/holidays?year=2026&country=MX
 * Devuelve feriados del año (para el estimado de fecha de depósito). Cachea en
 * HolidayCalendar: si ya hay filas del año, las devuelve; si no, las trae de
 * date.nager.at (feriados civiles ≈ inhábiles bancarios — estimado) y upserta.
 */
export async function getHolidays(req: Request, res: Response, next: NextFunction) {
  try {
    const year = Number(req.query.year)
    const country = (req.query.country as string) || 'MX'
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestError('year inválido')
    }

    const existing = await prisma.holidayCalendar.findMany({
      where: { year },
      select: { date: true, name: true },
      orderBy: { date: 'asc' },
    })
    if (existing.length > 0) {
      res.json({
        success: true,
        data: existing.map((h) => ({ date: h.date.toISOString().slice(0, 10), name: h.name })),
      })
      return
    }

    const resp = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${encodeURIComponent(country)}`,
    )
    if (!resp.ok) {
      res.status(502).json({ success: false, error: 'No se pudieron obtener los feriados' })
      return
    }
    const holidays = (await resp.json()) as NagerHoliday[]

    for (const h of holidays) {
      await prisma.holidayCalendar.upsert({
        where: { date_holidayType: { date: new Date(h.date), holidayType: 'BANKING' } },
        create: {
          name: h.localName || h.name,
          date: new Date(h.date),
          year,
          holidayType: 'BANKING',
          isBanking: true,
        },
        update: { name: h.localName || h.name },
      })
    }
    res.json({
      success: true,
      data: holidays.map((h) => ({ date: h.date, name: h.localName || h.name })),
    })
  } catch (error) {
    next(error)
  }
}
```

> Si el server usa `axios` en vez de `fetch` global, reemplaza el `fetch(...)` por `axios.get(...)`. Si el compound unique tiene otro nombre, ajústalo (lo confirma `npx prisma generate` types / el cliente). El enum `HolidayType` tiene `FEDERAL|BANKING|GENERAL`.

- [ ] **Step 3: Route** `holidays.routes.ts`:

```ts
import { Router } from 'express'
import * as holidaysController from '../../controllers/superadmin/holidays.controller'

const router = Router()
// GET /api/v1/superadmin/holidays?year=&country=
router.get('/', holidaysController.getHolidays)
export default router
```

- [ ] **Step 4: Mount** en `superadmin.routes.ts`: `import holidaysRoutes from './superadmin/holidays.routes'` + `router.use('/holidays', holidaysRoutes)`.

- [ ] **Step 5:** `cd avoqado-server && npx tsc --noEmit` → no new errors. `curl -s -i 'localhost:3000/api/v1/superadmin/holidays?year=2026' | head -1` (con sesión) → no `404`. No commit. `git status --porcelain` confirma sólo estos 3 archivos nuevos en el set.

---

## Task A2: `settlement.ts` — proyección pura (TDD)

**Files:** Create `src/features/merchants/settlement.ts` + `settlement.test.ts`

- [ ] **Step 1: Test primero**

```ts
import { describe, it, expect } from 'vitest'
import { projectSettlementDate } from './settlement'

// 2026-05-22 es viernes (UTC).
const friday = new Date(Date.UTC(2026, 4, 22))
const iso = (d: Date) => d.toISOString().slice(0, 10)

describe('projectSettlementDate', () => {
  it('días=0 → mismo día', () => {
    expect(iso(projectSettlementDate(friday, 0, 'BUSINESS_DAYS', new Set()))).toBe('2026-05-22')
  })
  it('D+1 hábil salta el fin de semana (vie → lun)', () => {
    expect(iso(projectSettlementDate(friday, 1, 'BUSINESS_DAYS', new Set()))).toBe('2026-05-25')
  })
  it('D+3 hábil (vie → mié)', () => {
    expect(iso(projectSettlementDate(friday, 3, 'BUSINESS_DAYS', new Set()))).toBe('2026-05-27')
  })
  it('salta un feriado intermedio', () => {
    // lunes 25 feriado → D+1 cae el martes 26
    expect(iso(projectSettlementDate(friday, 1, 'BUSINESS_DAYS', new Set(['2026-05-25'])))).toBe(
      '2026-05-26',
    )
  })
  it('CALENDAR_DAYS suma días naturales', () => {
    expect(iso(projectSettlementDate(friday, 3, 'CALENDAR_DAYS', new Set()))).toBe('2026-05-25')
  })
})
```

- [ ] **Step 2: Correr → FAIL.** `npx vitest run src/features/merchants/settlement.test.ts`

- [ ] **Step 3: Implementar**

```ts
import type { SettlementDayType } from './types'

/**
 * Proyecta la fecha de depósito (estimado). Opera en espacio de fecha-civil
 * usando componentes UTC para ser determinista: el caller pasa un `from` cuyo
 * día UTC = el día civil deseado (ver `mxCivilToday`). `holidays` = set de
 * 'YYYY-MM-DD' (lo que devuelve el endpoint /holidays y Nager).
 */
export function projectSettlementDate(
  from: Date,
  days: number,
  dayType: SettlementDayType,
  holidays: Set<string>,
): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  if (dayType === 'CALENDAR_DAYS') {
    d.setUTCDate(d.getUTCDate() + days)
    return d
  }
  let counted = 0
  while (counted < days) {
    d.setUTCDate(d.getUTCDate() + 1)
    const dow = d.getUTCDay() // 0 dom, 6 sáb
    const isoDay = d.toISOString().slice(0, 10)
    if (dow !== 0 && dow !== 6 && !holidays.has(isoDay)) counted++
  }
  return d
}

/** Día civil de hoy en America/Mexico_City, como Date UTC-midnight (para `from`). */
export function mxCivilToday(now: Date = new Date()): Date {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now) // 'YYYY-MM-DD'
  const [y, m, dd] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, dd))
}

/** Formatea un Date UTC-midnight como fecha civil es-MX (sin corrimiento de TZ). */
export function formatCivilDate(d: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}
```

- [ ] **Step 4: Correr → PASS.** `npx tsc --noEmit`.

---

## Task A3: api + hooks (holidays + saveSettlement)

**Files:** Modify `src/features/merchants/api.ts`, `use-merchants.ts`

- [ ] **Step 1: api.ts append** (importa `CardType`, `SettlementDayType` de `./types` si faltan):

```ts
/* --- Holidays + settlement save (F3) --- */

export async function fetchHolidays(year: number, country = 'MX'): Promise<Set<string>> {
  const { data } = await api.get<{ data: { date: string; name: string }[] }>(
    '/superadmin/holidays',
    {
      params: { year, country },
    },
  )
  return new Set((data?.data ?? []).map((h) => h.date))
}

export interface SettlementRowInput {
  cardType: CardType
  settlementDays: number
  settlementDayType: SettlementDayType
}

/** Por tarjeta: PUT la config activa (id en `existingByCard`) o POST si no existe. */
export async function saveSettlement(
  merchantAccountId: string,
  rows: SettlementRowInput[],
  cutoffTime: string,
  cutoffTimezone: string,
  existingByCard: Record<string, string>,
): Promise<void> {
  for (const r of rows) {
    const body = {
      merchantAccountId,
      cardType: r.cardType,
      settlementDays: r.settlementDays,
      settlementDayType: r.settlementDayType,
      cutoffTime,
      cutoffTimezone,
    }
    const id = existingByCard[r.cardType]
    if (id) {
      await api.put(`/superadmin/settlement-configurations/${encodeURIComponent(id)}`, body)
    } else {
      await api.post('/superadmin/settlement-configurations', {
        ...body,
        effectiveFrom: new Date().toISOString(),
      })
    }
  }
}
```

- [ ] **Step 2: use-merchants.ts append** (importa `fetchHolidays`, `saveSettlement`, `type SettlementRowInput` de `./api`):

```ts
export function useHolidays(year: number) {
  return useQuery({
    queryKey: ['superadmin', 'holidays', year],
    queryFn: () => fetchHolidays(year),
    staleTime: 24 * 60 * 60_000,
  })
}

export function useSaveSettlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      merchantAccountId: string
      rows: SettlementRowInput[]
      cutoffTime: string
      cutoffTimezone: string
      existingByCard: Record<string, string>
    }) =>
      saveSettlement(
        vars.merchantAccountId,
        vars.rows,
        vars.cutoffTime,
        vars.cutoffTimezone,
        vars.existingByCard,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}
```

- [ ] **Step 3:** `npx tsc --noEmit` → clean.

---

# Parte F3·B — Drawer + wire + logAction + gate

## Task B1: `EditSettlementDrawer` + test

**Files:** Create `src/features/merchants/EditSettlementDrawer.tsx` + `EditSettlementDrawer.test.tsx`

- [ ] **Step 1: Implementar.** Props `{ open, onOpenChange, merchantId, settlements: SettlementConfiguration[], onSaved? }`. Construye `existingByCard` (cardType→id) y filas iniciales desde `settlements` (default por tarjeta: déb/créd `{days:1}`, amex/intl `{days:3}`, `BUSINESS_DAYS`). Cutoff inicial = `settlements[0]?.cutoffTime ?? '23:00'`, tz `?? 'America/Mexico_City'`. Carga feriados con `useHolidays(new Date().getFullYear())`. Por cada tarjeta muestra input `días` + `Combobox` tipo + columna preview `formatCivilDate(projectSettlementDate(mxCivilToday(), días, tipo, holidays))`. Guarda con `useSaveSettlement` → `toast`/`inspectApiError`. Estructura igual a `EditEconomicsDrawer` (Drawer/Body/Footer). Importa de `./settlement` y `./types` (`CARD_TYPES`, `humanizeCardType`, `SettlementConfiguration`, `SettlementDayType`).

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
import { Combobox } from '@/shared/ui/Combobox'
import { inspectApiError } from '@/shared/lib/api-error'
import { useHolidays, useSaveSettlement } from './use-merchants'
import { projectSettlementDate, mxCivilToday, formatCivilDate } from './settlement'
import {
  CARD_TYPES,
  humanizeCardType,
  type CardType,
  type SettlementConfiguration,
  type SettlementDayType,
} from './types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  settlements: SettlementConfiguration[]
  onSaved?: () => void
}

const DEFAULT_DAYS: Record<CardType, number> = { DEBIT: 1, CREDIT: 1, AMEX: 3, INTERNATIONAL: 3 }

export function EditSettlementDrawer({
  open,
  onOpenChange,
  merchantId,
  settlements,
  onSaved,
}: Props) {
  const save = useSaveSettlement()
  const holidaysQ = useHolidays(new Date().getFullYear())
  const holidays = holidaysQ.data ?? new Set<string>()

  const byCard = new Map(settlements.map((s) => [s.cardType, s]))
  const [rows, setRows] = useState(() =>
    CARD_TYPES.map((card) => {
      const s = byCard.get(card)
      return {
        cardType: card,
        settlementDays: s?.settlementDays ?? DEFAULT_DAYS[card],
        settlementDayType: (s?.settlementDayType ?? 'BUSINESS_DAYS') as SettlementDayType,
      }
    }),
  )
  const [cutoffTime, setCutoffTime] = useState(settlements[0]?.cutoffTime || '23:00')
  const [cutoffTimezone] = useState(settlements[0]?.cutoffTimezone || 'America/Mexico_City')
  const [error, setError] = useState<string | null>(null)

  const today = mxCivilToday()
  const existingByCard: Record<string, string> = Object.fromEntries(
    settlements.map((s) => [s.cardType, s.id]),
  )

  function setRow(card: CardType, patch: Partial<(typeof rows)[number]>) {
    setRows((rs) => rs.map((r) => (r.cardType === card ? { ...r, ...patch } : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await save.mutateAsync({
        merchantAccountId: merchantId,
        rows,
        cutoffTime,
        cutoffTimezone,
        existingByCard,
      })
      toast.success('Liquidación actualizada')
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      const i = inspectApiError(err, 'guardar la liquidación')
      setError(i.description)
      toast.error(i.title, { description: i.description })
    }
  }

  const numInput =
    'h-9 w-16 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>Editar liquidación</DrawerTitle>
          <DrawerSubtitle>Días de depósito por tipo de tarjeta.</DrawerSubtitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DrawerBody>
            <div className="flex flex-col gap-3">
              {rows.map((r) => {
                const eta = projectSettlementDate(
                  today,
                  r.settlementDays,
                  r.settlementDayType,
                  holidays,
                )
                return (
                  <div
                    key={r.cardType}
                    className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] py-2 last:border-0"
                  >
                    <span className="w-24 text-[13px] text-[var(--ink-muted)]">
                      {humanizeCardType(r.cardType)}
                    </span>
                    <label className="flex items-center gap-1.5 text-[12px] text-[var(--ink-faint)]">
                      D+
                      <input
                        className={numInput}
                        inputMode="numeric"
                        value={String(r.settlementDays)}
                        onChange={(e) =>
                          setRow(r.cardType, {
                            settlementDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        aria-label={`Días ${humanizeCardType(r.cardType)}`}
                      />
                    </label>
                    <div className="w-36">
                      <Combobox
                        value={r.settlementDayType}
                        onChange={(v) =>
                          setRow(r.cardType, { settlementDayType: v as SettlementDayType })
                        }
                        options={[
                          { value: 'BUSINESS_DAYS', label: 'Hábiles' },
                          { value: 'CALENDAR_DAYS', label: 'Naturales' },
                        ]}
                        ariaLabel={`Tipo de días ${humanizeCardType(r.cardType)}`}
                      />
                    </div>
                    <span className="ml-auto text-[12px] tabular-nums text-[var(--ink)]">
                      {formatCivilDate(eta)}
                    </span>
                  </div>
                )
              })}

              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="cutoff" className="text-[12px] text-[var(--ink-muted)]">
                  Corte
                </label>
                <input
                  id="cutoff"
                  className={numInput.replace('w-16', 'w-24')}
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  placeholder="23:00"
                />
                <span className="text-[12px] text-[var(--ink-faint)]">{cutoffTimezone}</span>
              </div>
              <p className="text-[11.5px] text-[var(--ink-faint)]">
                Estimado: excluye fines de semana
                {holidays.size > 0 ? ' y feriados' : ' (feriados no disponibles)'}. No es la fecha
                real de liquidación.
              </p>
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
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Step 2: Test (MSW).** `settlements = [{ id:'s1', merchantAccountId:'m1', cardType:'DEBIT', settlementDays:1, settlementDayType:'BUSINESS_DAYS', cutoffTime:'23:00', cutoffTimezone:'America/Mexico_City', effectiveFrom:'2026-01-01T00:00:00.000Z', effectiveTo:null }]`. MSW: `GET /superadmin/holidays` → `{ data: [] }`; `PUT /superadmin/settlement-configurations/s1` capturando body. Render `<EditSettlementDrawer open merchantId="m1" settlements={settlements} onOpenChange={()=>{}} />`. Cambia "Días Débito" a `2`, submit "Guardar", **assert el PUT a `/settlement-configurations/s1` con `settlementDays: 2`** + toast. (Las demás tarjetas sin config → POST; el test puede ignorarlas con un handler POST genérico que responda 201.)

- [ ] **Step 3: Correr → PASS.** `npx tsc --noEmit`.

---

## Task B2: Wire `EditSettlementDrawer` en la sección Liquidación

**Files:** Modify `src/features/merchants/MerchantDetailPage.tsx`

- [ ] **Step 1:** Importa `EditSettlementDrawer`. Añade `const [editingSettlement, setEditingSettlement] = useState(false)`. En el `<Section title="Liquidación">`, agrega junto al título un `<Button size="sm" variant="ghost" onClick={() => setEditingSettlement(true)}>Editar</Button>` (envuelve el título + botón en un row `flex items-center justify-between`, o usa el patrón de la sección Economía de F2). Al final del Shell:

```tsx
<EditSettlementDrawer
  open={editingSettlement}
  onOpenChange={setEditingSettlement}
  merchantId={m.id}
  settlements={eco.settlements}
  onSaved={eco.refetch}
/>
```

(`eco.settlements` ya lo expone `useMerchantEconomicsData`.)

- [ ] **Step 2:** `npx vitest run src/features/merchants` + `npx tsc --noEmit` → verdes (no romper el test de detalle).

---

## Task B3: Server `logAction` en settlement (avoqado-server)

**Files:** Modify `avoqado-server/src/controllers/superadmin/settlementConfiguration.controller.ts`

- [ ] **Step 1:** Mismo patrón que F1/F2 (import `logAction`, `staffId: (req as any).user?.uid`). En `createSettlementConfiguration` y `updateSettlementConfiguration` (y opcionalmente `bulkCreateSettlementConfigurations`): `await logAction({ staffId, action: 'SETTLEMENT_CONFIG_CREATED'|'SETTLEMENT_CONFIG_UPDATED', entity: 'SettlementConfiguration', entityId: <id>, data: { merchantAccountId, cardType, settlementDays, settlementDayType }, ipAddress: req.ip, userAgent: req.headers['user-agent'] })`. Sólo ese archivo. Sin commit.

- [ ] **Step 2:** `cd avoqado-server && npx tsc --noEmit` → clean.

---

## Task B4: Docs + gate

**Files:** Modify `CHANGELOG.md`

- [ ] **Step 1:** CHANGELOG `[Unreleased] · Added`: "Merchant accounts (F3): edición de liquidación (días D+N por tarjeta + tipo/corte) con estimado de fecha de depósito (excluye fines de semana + feriados de date.nager.at, cacheados en HolidayCalendar vía nuevo endpoint `/superadmin/holidays`); `logAction` en settlement-configurations."
- [ ] **Step 2:** `npx prettier --write "src/features/merchants/**/*.{ts,tsx}"`. `npm run check` + `npm run build` → verdes.
- [ ] **Step 3:** `impeccable:audit` (controller) — arreglar ≥ high.

---

## Self-review (cobertura)

- §2 editar settlement → A3/B1/B2; proyección → A2 (`settlement.ts`) usada por B1; endpoint holidays → A1; logAction → B3.
- §3 editar-en-sitio (PUT/POST) → `saveSettlement`. §4 contratos → A1/A3. §6 algoritmo → A2 con tests (finde + feriado + calendar + days=0). §7 drawer → B1.
- Tipos consistentes: `SettlementRowInput`, `SettlementConfiguration`, `SettlementDayType`, `projectSettlementDate`/`mxCivilToday`/`formatCivilDate`.
- Abiertos (§9): cliente HTTP del server (fetch/axios) + nombre del compound unique de HolidayCalendar → A1 Step 1 los verifica.
