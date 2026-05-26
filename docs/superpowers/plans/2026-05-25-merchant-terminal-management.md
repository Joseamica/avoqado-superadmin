# Merchant terminal management (desde el detalle) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o superpowers:executing-plans. Steps usan checkbox (`- [ ]`).

**Goal:** Anexar/quitar terminales a un merchant desde `/merchants/:id`, preservando la herencia del slot del venue (lógica en el server).

**Architecture:** Nuevo endpoint aditivo `PUT /superadmin/merchant-accounts/:id/terminals/:terminalId {serves}` + `GET .../assignable-terminals` en `avoqado-server`; la semántica "effective(T) ∪/∖ {M}" vive en `merchantAccount.service.ts`. Frontend: la sección Terminales del detalle gana badge asignada/heredada + Quitar + Drawer "Asignar terminal". Frontend ya consume el conteo inheritance-aware.

**Tech Stack:** avoqado-server (Express + Prisma + Jest) · avoqado-superadmin (React + TanStack Query + Vitest/RTL/MSW + Drawer/Combobox/IconButton/Badge/Dialog).

**Spec:** `docs/superpowers/specs/2026-05-25-merchant-terminal-management-design.md`. **Restricción:** branch `develop`, sin worktree/branch, **sin commit**, sin `npm run format` global. Server aditivo deploy-first; `logAction` con `req.headers?.['user-agent']`.

---

## Task 1: Server — service + endpoint + tests

**Files:**

- Modify: `avoqado-server/src/services/superadmin/merchantAccount.service.ts`
- Modify: `avoqado-server/src/controllers/superadmin/merchantAccount.controller.ts`
- Modify: `avoqado-server/src/routes/superadmin/merchantAccount.routes.ts`
- Test: `avoqado-server/tests/unit/services/superadmin/merchantAccount.terminalManagement.test.ts`
- Test (extend): `avoqado-server/tests/unit/services/superadmin/merchantAccount.effectiveTerminals.test.ts`

- [ ] **Step 1: Extender `resolveEffectiveTerminals` con `inherited`.** El element pasa de `{id, serialNumber}` a `{id, serialNumber, inherited}` (`inherited = (rama heredada)`):

```ts
// dentro de resolveEffectiveTerminals: el tipo de retorno y attribute()
): Promise<Record<string, Array<{ id: string; serialNumber: string; inherited: boolean }>>> {
  // ...
  const attribute = (mid: string, t: { id: string; serialNumber: string | null }, inherited: boolean) => {
    if (!merchantVenueIds.has(mid)) return
    if (!seen[mid]) seen[mid] = new Set()
    if (seen[mid].has(t.id)) return
    seen[mid].add(t.id)
    ;(result[mid] ??= []).push({ id: t.id, serialNumber: t.serialNumber || '', inherited })
  }
  for (const t of terminals) {
    if (t.assignedMerchantIds.length > 0) for (const mid of t.assignedMerchantIds) attribute(mid, t, false)
    else for (const mid of merchantsByVenue[t.venueId] ?? []) attribute(mid, t, true)
  }
```

Actualizar el mapeo en `getMerchantAccount` (detalle) para exponer `inherited` en `terminals`: `terminals: assignedTerminals.map(t => ({ id: t.id, serialNumber: t.serialNumber, inherited: t.inherited }))`. La lista (`getMerchantAccounts`) puede dejar `terminals: terminals.map(t => ({ id: t.id, serialNumber: t.serialNumber }))` (ignora `inherited`).

- [ ] **Step 2: Helper `venueSlotMerchantIds`** (privado, reutilizado):

```ts
async function venueSlotMerchantIds(
  venueId: string,
  tx: typeof prisma = prisma,
): Promise<string[]> {
  const cfg = await tx.venuePaymentConfig.findUnique({
    where: { venueId },
    select: { primaryAccountId: true, secondaryAccountId: true, tertiaryAccountId: true },
  })
  if (!cfg) return []
  return [cfg.primaryAccountId, cfg.secondaryAccountId, cfg.tertiaryAccountId].filter(
    Boolean,
  ) as string[]
}
```

- [ ] **Step 3: Failing test** `merchantAccount.terminalManagement.test.ts` (mock prisma `terminal.{findUnique,update}`, `venuePaymentConfig.findUnique`, `merchantAccount.findUnique`; mock `@/lib/providerDeviceCompatibility`). Casos: anexar-heredada → `set` = `unique(slots ∪ M)`; anexar-explícita → `∪ M`; quitar-explícita (queda con otros) → `\ M`; quitar-heredada → `slots \ M`; **borde**: quitar cuando `slots = [M]` y T heredada → throw `BadRequestError`; compat incompatible → throw. (Código de aserción concreto al implementar contra la firma real de `assertMerchantTerminalCompatible`.)

- [ ] **Step 4: `setTerminalServesMerchant`** (semántica §3 del spec):

```ts
export async function setTerminalServesMerchant(input: {
  merchantAccountId: string
  terminalId: string
  serves: boolean
}): Promise<{ terminalId: string; assignedMerchantIds: string[]; inherited: boolean }> {
  const { merchantAccountId, terminalId, serves } = input
  return prisma.$transaction(async (tx) => {
    const merchant = await tx.merchantAccount.findUnique({
      where: { id: merchantAccountId },
      select: { id: true },
    })
    if (!merchant) throw new NotFoundError(`Merchant account ${merchantAccountId} not found`)
    const terminal = await tx.terminal.findUnique({
      where: { id: terminalId },
      select: { id: true, venueId: true, assignedMerchantIds: true },
    })
    if (!terminal) throw new NotFoundError(`Terminal ${terminalId} not found`)

    const slots = await venueSlotMerchantIds(terminal.venueId, tx)
    const isExplicit = terminal.assignedMerchantIds.length > 0
    const effective = isExplicit ? terminal.assignedMerchantIds : slots

    let next: string[]
    if (serves) {
      await assertMerchantTerminalCompatible(terminalId, merchantAccountId, tx) // throws on mismatch
      next = [...new Set([...effective, merchantAccountId])]
    } else {
      next = effective.filter((id) => id !== merchantAccountId)
      // anti-re-herencia: array vacío re-hereda los slots → si M sigue en slots, no podemos vaciar
      if (next.length === 0 && slots.includes(merchantAccountId)) {
        throw new BadRequestError(
          'Esta es la única cuenta del venue; para que la terminal deje de procesarla, asigna otra cuenta al slot del venue o cambia el slot.',
        )
      }
    }

    await tx.terminal.update({
      where: { id: terminalId },
      data: { assignedMerchantIds: { set: next } },
    })
    return { terminalId, assignedMerchantIds: next, inherited: next.length === 0 }
  })
}
```

Imports ya presentes en el archivo: `prisma`, `NotFoundError`, `BadRequestError`, `assertMerchantTerminalCompatible`.

- [ ] **Step 5: `getAssignableTerminals`** (candidatas: en venues del merchant, compatibles, que aún NO sirven M = restringidas sin M):

```ts
export async function getAssignableTerminals(merchantAccountId: string) {
  // venues donde M está slotteado
  const cfgs = await prisma.venuePaymentConfig.findMany({
    where: {
      OR: [
        { primaryAccountId: merchantAccountId },
        { secondaryAccountId: merchantAccountId },
        { tertiaryAccountId: merchantAccountId },
      ],
    },
    select: { venueId: true },
  })
  const venueIds = cfgs.map((c) => c.venueId)
  if (venueIds.length === 0) return []
  const merchant = await prisma.merchantAccount.findUnique({
    where: { id: merchantAccountId },
    select: { provider: { select: { code: true } } },
  })
  const brand =
    merchant?.provider.code === 'ANGELPAY'
      ? 'NEXGO'
      : merchant?.provider.code === 'BLUMON'
        ? 'PAX'
        : null
  const terminals = await prisma.terminal.findMany({
    where: {
      venueId: { in: venueIds },
      NOT: { assignedMerchantIds: { has: merchantAccountId } },
      assignedMerchantIds: { isEmpty: false }, // las vacías ya heredan M (ya lo sirven)
      ...(brand ? { brand } : {}),
    },
    select: {
      id: true,
      serialNumber: true,
      name: true,
      venueId: true,
      brand: true,
      venue: { select: { name: true } },
    },
  })
  return terminals.map((t) => ({
    id: t.id,
    serialNumber: t.serialNumber || '',
    name: t.name,
    venueId: t.venueId,
    venueName: t.venue?.name ?? '',
    brand: t.brand,
  }))
}
```

> Verificar al implementar: el mapeo brand→provider real (reusar `providerDeviceCompatibility` si exporta un helper en vez de hardcodear NEXGO/PAX). Si exporta uno, usarlo.

- [ ] **Step 6: Controller handlers + `logAction`** en `merchantAccount.controller.ts`:

```ts
export async function setTerminalServesMerchant(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, terminalId } = req.params
    const serves = req.body?.serves === true
    const data = await merchantAccountService.setTerminalServesMerchant({
      merchantAccountId: id,
      terminalId,
      serves,
    })
    logAction({
      staffId: (req as any).user?.uid ?? null,
      action: serves ? 'MERCHANT_TERMINAL_ASSIGNED' : 'MERCHANT_TERMINAL_UNASSIGNED',
      entity: 'Terminal',
      entityId: terminalId,
      data: { merchantAccountId: id, serves, assignedMerchantIds: data.assignedMerchantIds },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    }).catch(() => {})
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}
export async function getAssignableTerminals(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await merchantAccountService.getAssignableTerminals(req.params.id)
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}
```

> Verificar al implementar la firma real de `logAction` (import + args) copiando un uso existente en este controller.

- [ ] **Step 7: Rutas** en `merchantAccount.routes.ts` (ANTES de `/:id` genérico, junto a las demás `/:id/terminals`):

```ts
router.get('/:id/assignable-terminals', merchantAccountController.getAssignableTerminals)
router.put('/:id/terminals/:terminalId', merchantAccountController.setTerminalServesMerchant)
```

- [ ] **Step 8: Correr tests + typecheck.**

```bash
cd avoqado-server
npx jest tests/unit/services/superadmin/merchantAccount.terminalManagement.test.ts tests/unit/services/superadmin/merchantAccount.effectiveTerminals.test.ts
npx tsc -p tsconfig.build.json --noEmit   # EXIT 0
```

---

## Task 2: Frontend — api + hooks + types

**Files:**

- Modify: `avoqado-superadmin/src/features/merchants/types.ts` (terminals gana `inherited`)
- Modify: `avoqado-superadmin/src/features/merchants/api.ts` (3 fns + RawMerchant.terminals.inherited)
- Modify: `avoqado-superadmin/src/features/merchants/use-merchants.ts` (hooks)

- [ ] **Step 1: `types.ts`** — `terminals: { id: string; serialNumber: string; inherited: boolean }[]` (en `MerchantAccount`). `AssignableTerminal` nuevo: `{ id; serialNumber; name; venueId; venueName; brand: string | null }`.

- [ ] **Step 2: `api.ts`** — en `RawMerchant.terminals` agregar `inherited: boolean`; en `mapMerchant`: `terminals: (r.terminals ?? []).map(t => ({ ...t, inherited: t.inherited ?? false }))`. Nuevas fns:

```ts
export async function assignTerminal(
  merchantId: string,
  terminalId: string,
  serves: boolean,
): Promise<void> {
  await api.put(
    `/superadmin/merchant-accounts/${encodeURIComponent(merchantId)}/terminals/${encodeURIComponent(terminalId)}`,
    { serves },
  )
}
export async function fetchAssignableTerminals(merchantId: string): Promise<AssignableTerminal[]> {
  const { data } = await api.get<{ data: AssignableTerminal[] }>(
    `/superadmin/merchant-accounts/${encodeURIComponent(merchantId)}/assignable-terminals`,
  )
  return data.data
}
```

- [ ] **Step 3: `use-merchants.ts`** — hooks:

```ts
export function useAssignableTerminals(merchantId: string | undefined) {
  return useQuery({
    queryKey: ['superadmin', 'merchants', merchantId, 'assignable-terminals'],
    queryFn: () => fetchAssignableTerminals(merchantId!),
    enabled: !!merchantId,
  })
}
export function useSetTerminalServes(merchantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ terminalId, serves }: { terminalId: string; serves: boolean }) =>
      assignTerminal(merchantId, terminalId, serves),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'merchants', merchantId] })
      qc.invalidateQueries({ queryKey: ['superadmin', 'merchants'] })
      qc.invalidateQueries({
        queryKey: ['superadmin', 'merchants', merchantId, 'assignable-terminals'],
      })
    },
  })
}
```

> Verificar al implementar los imports/patrones reales de query keys en `use-merchants.ts`.

- [ ] **Step 4: `npx tsc --noEmit` (superadmin) EXIT 0.**

---

## Task 3: Frontend — UI (sección Terminales)

**Files:**

- Modify: `avoqado-superadmin/src/features/merchants/MerchantDetailPage.tsx` (sección Terminales)
- Create: `avoqado-superadmin/src/features/merchants/AssignTerminalDrawer.tsx`
- Test: `avoqado-superadmin/src/features/merchants/MerchantDetailPage.test.tsx` (extender)

- [ ] **Step 1: Sección Terminales** — cada fila: serial + `<Badge tone="muted" size="sm">{t.inherited ? 'heredada' : 'asignada'}</Badge>` + `<IconButton aria-label="Quitar terminal" ...>` (icono `Unlink`/`X`). Header de la sección: `<Button size="sm" variant="ghost">Asignar terminal</Button>`. "Quitar" en heredada → abre `<Dialog>` de confirmación (texto del spec §4); en explícita → `setServes({terminalId, serves:false})` directo. onError → `toast.error(inspectApiError(e).title, { description })` (muestra el mensaje del borde).

- [ ] **Step 2: `AssignTerminalDrawer.tsx`** — `Drawer` con `Combobox` de `useAssignableTerminals(merchantId).data` (`options`: value=id, label=serial, description=`${venueName} · ${brand}`), empty state "No hay terminales para anexar; todas las compatibles ya lo procesan." Confirmar → `setServes({terminalId, serves:true})` → cerrar.

- [ ] **Step 3: Test** (extender `MerchantDetailPage.test.tsx`, MSW): merchant con `terminals: [{id:'t1',serialNumber:'S1',inherited:true}]` → badge "heredada" visible; click "Quitar" en heredada → aparece el Dialog de confirmación. (Mock `PUT .../terminals/t1` y `GET .../assignable-terminals`.)

- [ ] **Step 4: Gate.** `cd avoqado-superadmin && npm run check && npm run build` (verde).

- [ ] **Step 5: CHANGELOG** (`### Added`): "Gestión de terminales desde `/merchants/:id`: anexar/quitar (preservando herencia del slot del venue) + endpoint `PUT /superadmin/merchant-accounts/:id/terminals/:terminalId` y `GET .../assignable-terminals` (avoqado-server, `logAction`)."

---

## Self-review

- **Spec coverage:** §3 endpoint+semántica → T1 (steps 4-7). §3 borde → T1 step 4 + test step 3. §3 assignable → T1 step 5. §4 frontend (badges/Quitar/Drawer/Dialog/invalidación) → T2+T3. §5 archivos → T1. §6 testing → T1 step 3, T3 step 3. ✅
- **Tipos consistentes:** `setTerminalServesMerchant` (service y controller mismo nombre), `{ serves }` body, `terminals[].inherited`, `AssignableTerminal` shape igual en server map y frontend type. ✅
- **Placeholders:** los "verificar al implementar" son sobre firmas reales de helpers existentes (`logAction`, `assertMerchantTerminalCompatible`, brand mapping) — se resuelven leyendo el archivo, no son lógica sin definir. La lógica nueva está completa.
