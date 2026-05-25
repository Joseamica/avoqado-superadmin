# Merchant Accounts — F1 Parte B: CRUD de identidad · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Añadir a `/merchants` el CRUD de identidad — alta manual, editar identidad, activar/desactivar, borrar (con aviso de cascada) — más los `logAction` server-side y 3 quick-wins de a11y de F1·A.

**Architecture:** Extiende el feature `src/features/merchants/` (api + hooks de F1·A). Form en un `Drawer`, borrado con `Dialog` de confirmación. Mutaciones TanStack que invalidan `['superadmin','merchants']`. Sin commits (queda en `develop` sin commitear para revisión del usuario).

**Tech Stack:** igual que F1·A + `sonner` (toasts) + zod.

**Depends on:** F1·A (`docs/superpowers/plans/2026-05-24-merchant-accounts-f1a-foundation-registry.md`). **Restricción:** branch `develop`, sin worktree/branch, sin commit, sin `npm run format` global.

---

## Contratos del backend (verificados)

- `POST /superadmin/merchant-accounts` body: `{ providerId*, externalMerchantId*, alias?, displayName?, active?, displayOrder?, credentials?: {merchantId, apiKey}, providerConfig?, blumonSerialNumber?, blumonEnvironment?, blumonMerchantId? }`. `credentials` requerido salvo cuenta Blumon-pending (trae `blumonSerialNumber` y se omiten creds). Respuesta `201 { success, data }`.
- `PUT /superadmin/merchant-accounts/:id` body: `{ externalMerchantId?, alias?, displayName?, active?, displayOrder?, credentials?, providerConfig? }`. **Proveedor inmutable** (no se envía). Respuesta `200 { success, data }`.
- `PATCH /superadmin/merchant-accounts/:id/toggle` → `200 { success, data }`.
- `DELETE /superadmin/merchant-accounts/:id` → `200 { success, message }`. Sólo permitido si no hay cost structures / venue configs que la referencien (el server valida; mostramos el conteo como aviso).

---

## Task B1: api.ts — mutaciones

**Files:** Modify `src/features/merchants/api.ts`

- [ ] **Step 1: Agregar al final de `api.ts`**

```ts
/* --- Mutations (identidad) --- */

export interface MerchantCredentialsInput {
  merchantId: string
  apiKey: string
}

export interface CreateMerchantInput {
  providerId: string
  externalMerchantId: string
  alias?: string | null
  displayName?: string | null
  active?: boolean
  displayOrder?: number
  /** Requerido salvo cuenta Blumon-pending (con blumonSerialNumber y sin creds). */
  credentials?: MerchantCredentialsInput
  blumonSerialNumber?: string
  blumonEnvironment?: string
  blumonMerchantId?: string
}

export interface UpdateMerchantInput {
  externalMerchantId?: string
  alias?: string | null
  displayName?: string | null
  active?: boolean
  displayOrder?: number
}

export async function createMerchant(input: CreateMerchantInput): Promise<MerchantAccount> {
  const { data } = await api.post<{ data: RawMerchant }>('/superadmin/merchant-accounts', input)
  return mapMerchant(data.data)
}

export async function updateMerchant(
  id: string,
  input: UpdateMerchantInput,
): Promise<MerchantAccount> {
  const { data } = await api.put<{ data: RawMerchant }>(
    `/superadmin/merchant-accounts/${encodeURIComponent(id)}`,
    input,
  )
  return mapMerchant(data.data)
}

export async function toggleMerchant(id: string): Promise<MerchantAccount> {
  const { data } = await api.patch<{ data: RawMerchant }>(
    `/superadmin/merchant-accounts/${encodeURIComponent(id)}/toggle`,
  )
  return mapMerchant(data.data)
}

export async function deleteMerchant(id: string): Promise<void> {
  await api.delete(`/superadmin/merchant-accounts/${encodeURIComponent(id)}`)
}
```

- [ ] **Step 2:** `npx tsc --noEmit` → clean. (No commit.)

---

## Task B2: use-merchants.ts — mutation hooks

**Files:** Modify `src/features/merchants/use-merchants.ts`

- [ ] **Step 1: Agregar imports** (`useMutation`, `useQueryClient` de `@tanstack/react-query`; las funciones nuevas + tipos de `./api`).

- [ ] **Step 2: Agregar al final**

```ts
export function useCreateMerchant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMerchantInput) => createMerchant(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useUpdateMerchant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; input: UpdateMerchantInput }) =>
      updateMerchant(vars.id, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useToggleMerchant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => toggleMerchant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}

export function useDeleteMerchant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMerchant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY }),
  })
}
```

- [ ] **Step 3:** `npx tsc --noEmit` → clean.

---

## Task B3: MerchantIdentityDrawer.tsx (alta + editar)

**Files:** Create `src/features/merchants/MerchantIdentityDrawer.tsx` + `src/features/merchants/MerchantIdentityDrawer.test.tsx`

- [ ] **Step 1: Componente.** Drawer con form. Modo `create` (provider editable + credenciales) o `edit` (provider bloqueado, sin credenciales obligatorias). Validación zod. `toast` en éxito/error vía `inspectApiError`.

```tsx
import { useState } from 'react'
import { z } from 'zod'
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
import { useCreateMerchant, useProviders, useUpdateMerchant } from './use-merchants'
import type { MerchantAccount } from './types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa, es modo editar. Si no, alta. */
  merchant?: MerchantAccount
  onSaved?: (m: MerchantAccount) => void
}

const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'
const inputCls =
  'h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[14px] placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

export function MerchantIdentityDrawer({ open, onOpenChange, merchant, onSaved }: Props) {
  const isEdit = !!merchant
  const providersQ = useProviders()
  const createM = useCreateMerchant()
  const updateM = useUpdateMerchant()

  const [providerId, setProviderId] = useState(merchant?.provider.id ?? '')
  const [externalMerchantId, setExternalMerchantId] = useState(merchant?.externalMerchantId ?? '')
  const [displayName, setDisplayName] = useState(merchant?.displayName ?? '')
  const [alias, setAlias] = useState(merchant?.alias ?? '')
  const [merchantIdCred, setMerchantIdCred] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const saving = createM.isPending || updateM.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (isEdit && merchant) {
      const schema = z.object({
        externalMerchantId: z.string().min(1, 'El ID externo es obligatorio'),
        displayName: z.string().optional(),
        alias: z.string().optional(),
      })
      const parsed = schema.safeParse({ externalMerchantId, displayName, alias })
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
      updateM.mutate(
        {
          id: merchant.id,
          input: { externalMerchantId, displayName: displayName || null, alias: alias || null },
        },
        {
          onSuccess: (m) => {
            toast.success('Cuenta actualizada')
            onSaved?.(m)
            onOpenChange(false)
          },
          onError: (err) => {
            const i = inspectApiError(err, 'actualizar la cuenta')
            setError(i.description)
            toast.error(i.title, { description: i.description })
          },
        },
      )
      return
    }
    const schema = z.object({
      providerId: z.string().min(1, 'Elige un proveedor'),
      externalMerchantId: z.string().min(1, 'El ID externo es obligatorio'),
      merchantIdCred: z.string().min(1, 'merchantId de credenciales es obligatorio'),
      apiKey: z.string().min(1, 'apiKey es obligatorio'),
    })
    const parsed = schema.safeParse({ providerId, externalMerchantId, merchantIdCred, apiKey })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
    createM.mutate(
      {
        providerId,
        externalMerchantId,
        displayName: displayName || null,
        alias: alias || null,
        credentials: { merchantId: merchantIdCred, apiKey },
      },
      {
        onSuccess: (m) => {
          toast.success('Cuenta creada')
          onSaved?.(m)
          onOpenChange(false)
        },
        onError: (err) => {
          const i = inspectApiError(err, 'crear la cuenta')
          setError(i.description)
          toast.error(i.title, { description: i.description })
        },
      },
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>{isEdit ? 'Editar identidad' : 'Alta manual de cuenta'}</DrawerTitle>
          <DrawerSubtitle>
            {isEdit ? 'El proveedor no se puede cambiar.' : 'Crea una cuenta de pago manualmente.'}
          </DrawerSubtitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DrawerBody>
            <div className="flex flex-col gap-4">
              {!isEdit && (
                <div>
                  <label className={labelCls}>Proveedor</label>
                  <Combobox
                    value={providerId}
                    onChange={setProviderId}
                    options={(providersQ.data ?? []).map((p) => ({
                      value: p.id,
                      label: p.name,
                      description: p.code,
                    }))}
                    placeholder="Elige un proveedor"
                    ariaLabel="Proveedor"
                  />
                </div>
              )}
              <div>
                <label className={labelCls} htmlFor="extId">
                  ID externo del merchant
                </label>
                <input
                  id="extId"
                  className={inputCls}
                  value={externalMerchantId}
                  onChange={(e) => setExternalMerchantId(e.target.value)}
                />
              </div>
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
                <label className={labelCls} htmlFor="al">
                  Alias
                </label>
                <input
                  id="al"
                  className={inputCls}
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
              </div>
              {!isEdit && (
                <fieldset className="flex flex-col gap-3 rounded-[8px] border border-[var(--line)] p-3">
                  <legend className="px-1 text-[12px] font-medium text-[var(--ink-muted)]">
                    Credenciales
                  </legend>
                  <div>
                    <label className={labelCls} htmlFor="cmid">
                      merchantId
                    </label>
                    <input
                      id="cmid"
                      className={inputCls}
                      value={merchantIdCred}
                      onChange={(e) => setMerchantIdCred(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="cak">
                      apiKey
                    </label>
                    <input
                      id="cak"
                      className={inputCls}
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </fieldset>
              )}
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
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear cuenta'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
```

> Verify: `Button` variants (`variant="ghost"` exists? else use the closest secondary variant) in `src/shared/ui/Button.tsx`; `inspectApiError` return shape (`{title, description}`) in `src/shared/lib/api-error.ts`; `Combobox` `ariaLabel` prop is added in Task B5 (sequence B5 before/with B3, or temporarily omit `ariaLabel` until B5 lands).

- [ ] **Step 2: Test** (`MerchantIdentityDrawer.test.tsx`): render en modo create con MSW para `GET /superadmin/payment-providers` y `POST /superadmin/merchant-accounts`; llena ID externo + credenciales; submit; espera que se llame el POST y aparezca el toast/cierre. Usa `renderWithProviders`. (Escribe aserciones concretas: el botón "Crear cuenta" existe; validación muestra error si falta ID externo.)

- [ ] **Step 3:** `npx vitest run src/features/merchants/MerchantIdentityDrawer.test.tsx` → pass. `npx tsc --noEmit` → clean.

---

## Task B4: Wire acciones (lista + detalle) + borrar con confirmación

**Files:** Create `src/features/merchants/DeleteMerchantDialog.tsx`; Modify `MerchantsPage.tsx`, `MerchantDetailPage.tsx`

- [ ] **Step 1: `DeleteMerchantDialog.tsx`** — usa `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` de `@/shared/ui/Dialog`. Muestra aviso de cascada con los conteos (`merchant.counts.costStructures`, `.venueConfigs`). Botón "Borrar" (variant danger si existe; si no, default) → `useDeleteMerchant().mutate(id)` con `toast` + `onDeleted` callback. Maneja error con `inspectApiError` (ej. 409 si tiene dependencias) mostrándolo en el dialog.

- [ ] **Step 2: MerchantsPage** — agrega botón **"+ Alta manual"** en el header (abre `MerchantIdentityDrawer` en modo create; estado `const [creating, setCreating]`). Usa `<Button>` (no inline). Tras crear, navega al detalle (`useNavigate`) o deja que la invalidación refresque la lista.

- [ ] **Step 3: MerchantDetailPage** — en la cabecera agrega acciones: **Editar** (abre `MerchantIdentityDrawer` modo edit con `merchant={m}`), **Activar/Desactivar** (`useToggleMerchant`, con `toast`), **Borrar** (abre `DeleteMerchantDialog`; al borrar, `navigate('/merchants')`). Usa `<Button size="sm">`/`<IconButton>` — nada inline.

- [ ] **Step 4:** `npx vitest run src/features/merchants` + `npx tsc --noEmit` → verdes. Actualiza el test de detalle si cambia el header (las acciones no deben romper las aserciones existentes).

---

## Task B5: a11y quick-wins (de la auditoría F1·A)

**Files:** Modify `src/shared/ui/Combobox.tsx`, `src/features/merchants/ReadinessStrip.tsx`

- [ ] **Step 1: Combobox `ariaLabel`.** En `ComboboxProps` añade `ariaLabel?: string`; pásalo al botón trigger como `aria-label={ariaLabel}`. (Reuse-or-promote: el primitive gana soporte de etiqueta accesible para todo el repo.) Verifica que no rompe usos existentes (prop opcional).

- [ ] **Step 2: ReadinessStrip — anunciar estado + hint accesible.** Cada chip añade `aria-label`:

```tsx
aria-label={
  c.state === 'missing'
    ? `${c.label}: falta${c.hint ? `. ${c.hint}` : ''}`
    : c.state === 'ok'
      ? `${c.label}: configurado`
      : `${c.label}: desconocido`
}
```

Mantén el texto visible `c.label` (el test `getByText('Credenciales')` sigue verde) y el `title` para hover desktop.

- [ ] **Step 3: MoneyFlow** — pasa `ariaLabel="Tipo de tarjeta"` al `Combobox` (ahora soportado).

- [ ] **Step 4:** `npx vitest run` (suite completa) + `npx tsc --noEmit` → verdes.

---

## Task B6: Server — `logAction` en mutaciones de merchant (avoqado-server)

**Files:** Modify `avoqado-server/src/controllers/superadmin/merchantAccount.controller.ts`

> Aplicar pero **NO commitear** (igual que el mount de F1·A; el usuario lo despliega). Server-first.

- [ ] **Step 1:** Busca un call-site existente de `logAction` en el repo para copiar el patrón exacto `req.user → staffId` (`grep -rn "logAction(" src/controllers/superadmin | head`). Confirma de qué campo sale el staffId (los controllers usan `(req as any).user?.uid`).

- [ ] **Step 2:** Importa `logAction` desde `../../services/dashboard/activity-log.service` y añade una llamada **después** de cada mutación exitosa (create/update/toggle/delete), junto al `logger.info` existente:

```ts
await logAction({
  staffId: (req as any).user?.uid ?? null,
  action: 'MERCHANT_ACCOUNT_CREATED', // _UPDATED / _STATUS_TOGGLED / _DELETED según el handler
  entity: 'MerchantAccount',
  entityId: account.id, // o `id` en update/toggle/delete
  data: {
    /* campos relevantes no sensibles: externalMerchantId, providerId, active… NUNCA credenciales */
  },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
})
```

`logAction` es best-effort (try/catch interno, nunca throw), así que va con `await` sin romper la respuesta. **No registres credenciales** en `data`.

- [ ] **Step 3:** `cd avoqado-server && npx tsc --noEmit` → clean. No commit.

---

## Task B7: Docs + gate

**Files:** Modify `CHANGELOG.md`

- [ ] **Step 1:** CHANGELOG `[Unreleased] · Added`: "Merchant accounts (F1B): alta manual / editar identidad / activar-desactivar / borrar (con aviso de cascada); `logAction` server-side en las mutaciones; a11y de ReadinessStrip + label del Combobox."
- [ ] **Step 2:** `npx prettier --write "src/features/merchants/**/*.{ts,tsx}"` (sólo el feature). `npm run check` + `npm run build` → todo verde.
- [ ] **Step 3:** `impeccable:audit` (controller) — arreglar ≥ high si aparece.

---

## Self-review (cobertura)

- Alta manual → B3 (+B1/B2). Editar identidad → B3 (modo edit). Toggle → B4 (+B2). Borrar con cascada → B4 (DeleteMerchantDialog). `logAction` → B6. a11y de la auditoría → B5. Docs/gate → B7.
- Proveedor inmutable en edit (B3 oculta el Combobox en modo edit). Credenciales nunca se loguean (B6). Bank fields fuera (el endpoint los ignora).
- Sin commit; `develop`; sólo se formatean archivos nuevos.
