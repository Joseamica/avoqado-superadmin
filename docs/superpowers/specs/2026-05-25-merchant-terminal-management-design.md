# Merchant Accounts — Gestión de terminales desde el detalle · Diseño

> Estado: **aprobado**. Feature: consola superadmin (`avoqado-superadmin`), feature `merchants` + endpoint en `avoqado-server`.
> Fecha: 2026-05-25. Depende del fix inheritance-aware (`resolveEffectiveTerminals`). Reglas: branch `develop`, sin worktree/branch, **sin commit**, sin `npm run format` global. Server aditivo deploy-first.

## 1. Objetivo

Permitir **anexar / quitar** terminales a un merchant **desde el detalle** (`/merchants/:id`), respetando el modelo de routing de dos capas. "Mover" = quitar + anexar (sin op aparte). Hoy el detalle es read-only; la única superficie de gestión es `/terminals/:id/settings` (per-terminal, desde la terminal).

## 2. Modelo (recap — es el corazón del diseño)

Una terminal **sirve** a un merchant M cuando:

- **(a) explícito:** `Terminal.assignedMerchantIds` contiene M, **o**
- **(b) heredado:** `assignedMerchantIds` está **vacío** y M ocupa un slot del `VenuePaymentConfig` del venue de la terminal (fallback de herencia; ver `terminal.tpv.controller.ts`).

`assignedMerchantIds` no-vacío = "esta terminal SOLO sirve estos merchants" (restricción; deja de heredar).

**`effective(T)`** = `T.assignedMerchantIds` si no está vacío; si vacío = los merchants de los slots del venue de T.

## 3. Endpoint (nuevo, aditivo)

```
PUT /api/v1/superadmin/merchant-accounts/:id/terminals/:terminalId
body: { serves: boolean }
→ 200 { success, data: { terminalId, assignedMerchantIds, inherited: boolean } }
```

La **lógica vive en el server** (el routing vive ahí; no se filtra al cliente). Reusa `assertMerchantTerminalCompatible(terminalId, merchantId, tx)` (gate de brand-compat, p.ej. rechaza PAX+ANGELPAY) y registra `logAction`.

> Alternativa descartada: modificar `POST /:id/batch-assign-terminals` o `DELETE /:id/terminals/:terminalId` existentes — el dashboard legacy podría consumirlos; cambiar su semántica viola la política aditiva. El nuevo endpoint los deja intactos.

### Semántica (preservar herencia)

Sea `slots(venue)` = merchants en primary/secondary/tertiary del `VenuePaymentConfig` del venue de T. Sea `eff = effective(T)`.

| `serves`           | T heredada (array vacío)                                                                           | T explícita (no-vacío)                 |
| ------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **true** (anexar)  | `assignedMerchantIds := unique(slots(venue) ∪ {M})` — congela lo que ya servía + M (nada se cae)   | `:= unique(assignedMerchantIds ∪ {M})` |
| **false** (quitar) | `assignedMerchantIds := slots(venue) \ {M}` (restringe para dejar de servir M, conserva los demás) | `:= assignedMerchantIds \ {M}`         |

**Regla anti-re-herencia:** nunca dejar el array vacío si eso volvería a heredar M. Tras calcular el nuevo set en "quitar": si queda **vacío** y M **∈ `slots(venue)`** → vacío re-heredaría M → ver caso borde. Si queda vacío y M **∉ `slots(venue)`** (era explícito cross-venue) → vacío OK (hereda slots, que no incluyen M).

### Caso borde (decisión: **bloquear**)

"Quitar" cuando el nuevo set quedaría vacío **y** M ∈ `slots(venue)` (la terminal sirve sólo a M y M es el único merchant del slot del venue): **rechazar 409/422** con mensaje:

> "Esta es la única cuenta del venue; para que la terminal deje de procesarla, asigna otra cuenta al slot del venue (`/venues/:id/merchant`) o cambia el slot."

El frontend muestra ese `serverMessage` vía `inspectApiError` + `toast.error`.

### Terminales candidatas a anexar

```
GET /api/v1/superadmin/merchant-accounts/:id/assignable-terminals
→ { success, data: [{ id, serialNumber, name, venueId, venueName, brand }] }
```

= terminales **brand-compatibles** en los venues donde M está slotteado que **aún no sirven** a M (las heredadas ya lo sirven; candidatas = restringidas que excluyen M). Vacío ⇒ empty state "No hay terminales para anexar; todas las compatibles ya lo procesan."

## 4. Frontend (`/merchants/:id` → sección Terminales)

- El campo `terminals` del detalle gana `inherited: boolean` por fila (aditivo; viene de `resolveEffectiveTerminals`, que ya distingue rama explícita vs heredada).
- Cada fila: serial + **`<Badge tone="muted" size="sm">`** `asignada` / `heredada` + **`<IconButton>` Quitar** (`aria-label="Quitar terminal"`).
- Header de la sección: botón **`Asignar terminal`** → abre `Drawer` con un **`Combobox`** de `assignable-terminals` (search por serial/nombre/venue, `description` = venue + brand). Confirmar = `PUT { serves:true }`.
- "Quitar" en una **heredada** → `Dialog` de confirmación explicando "esta terminal pasará a estar restringida a [los demás merchants del venue] y dejará de heredar cambios futuros del slot del venue." En una **explícita** → quitar directo (sin diálogo).
- Mutaciones invalidan `['superadmin','merchants', id]` (detalle) y `['superadmin','merchants']` (lista, para el conteo). `toast.success`/`inspectApiError`.
- Reusa primitives: `Drawer`, `Combobox`, `IconButton`, `Badge`, `Dialog`, `Button`. Cero markup nuevo de patrones existentes.

## 5. Server — archivos

- `merchantAccount.service.ts`: `setTerminalServesMerchant({ merchantAccountId, terminalId, serves })` (semántica §3, en `$transaction`, compat gate, anti-re-herencia + borde) y `getAssignableTerminals(merchantAccountId)`. `resolveEffectiveTerminals` gana `inherited` por terminal (extiende el element a `{id, serialNumber, inherited}`); el detalle lo expone.
- `merchantAccount.controller.ts`: 2 handlers + `logAction({ action:'MERCHANT_TERMINAL_ASSIGNED'|'MERCHANT_TERMINAL_UNASSIGNED', entity:'Terminal', entityId:terminalId, data:{ merchantAccountId, serves, venueId } })`, `userAgent: req.headers?.['user-agent']`.
- `merchantAccount.routes.ts`: `PUT /:id/terminals/:terminalId`, `GET /:id/assignable-terminals` (antes de `/:id` catch-alls — ya hay precedente con `/:id/terminals`).

## 6. Testing

- **Server unit** (`setTerminalServesMerchant`, mock prisma): anexar-a-heredada (pre-seed = slots ∪ M), anexar-a-explícita (∪ M), quitar-de-explícita (\ M; si queda con otros, restringe), quitar-de-heredada (slots \ M), **borde bloqueado** (sólo M + único slot → throw), compat gate rechaza incompatible. Extiende `merchantAccount.effectiveTerminals.test.ts` con el `inherited` flag.
- **Frontend** (RTL+MSW): sección renderiza badges asignada/heredada; "Asignar terminal" lista candidatas y hace `PUT serves:true`; "Quitar" de heredada pide confirmación; el mensaje del borde sale por toast.
- Mantener verdes el fix inheritance-aware + el resto.

## 7. Decomposición (para el plan)

- **T1 (server):** `resolveEffectiveTerminals` + `inherited`; `setTerminalServesMerchant` + `getAssignableTerminals` + tests; handlers + rutas + `logAction`.
- **T2 (frontend api/hooks/types):** `terminals[].inherited`; `assignTerminal`/`unassignTerminal`/`fetchAssignableTerminals` + hooks; tipos.
- **T3 (frontend UI):** sección Terminales con badges + Quitar + Drawer "Asignar terminal" + Dialog de confirmación heredada + tests.

## 8. Riesgos / abiertos

- **Freeze de herencia:** anexar/quitar sobre una heredada la convierte en explícita → deja de recoger cambios futuros del slot. Es inherente al modelo; lo comunicamos en el Dialog de confirmación.
- **Multi-venue:** un merchant slotteado en varios venues; `slots(venue)` se calcula por el venue de **cada** terminal (no global). Cubierto.
- `assignable-terminals` se limita a los venues del merchant (no cross-venue arbitrario) — YAGNI; cross-venue explícito queda diferido.
