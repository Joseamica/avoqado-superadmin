# Merchant Accounts — Fase 5·A: Panel de alta Blumon · Diseño

> Estado: **propuesta para revisión**. Feature: consola superadmin (`avoqado-superadmin`), feature `merchants`.
> Fecha: 2026-05-25. Depende de F1–F4. Reglas: branch `develop`, sin worktree/branch, **sin commit**, sin `npm run format` global.

## 1. Objetivo

Alta guiada de un **merchant Blumon** para un venue, en **una transacción** (`POST /superadmin/merchant-accounts/blumon/full-setup`: auto-fetch de credenciales OAuth/DUKPT + crea cuenta + slot + auto-attach terminales por serial + costo/pricing/liquidación). La UX **NO es un stepper** sino un **panel de tarjetas de estado** (espejo del "Nuevo merchant AngelPay" del dashboard legacy — sólo ese patrón).

## 2. Patrón de UI (del screenshot aprobado)

- **Panel full-screen** (overlay `fixed inset-0`, cubre el sidebar). Lanzado desde **"+ Alta guiada (Blumon)"** en `MerchantsPage` (junto al "+ Alta manual" de F1·B). Ruta `/merchants/new`.
- **Header:** botón X (cerrar → `/merchants`) · título "Nuevo merchant Blumon" (centrado) · derecha: **"{listas} de {obligatorias} obligatorios ✓"** + CTA **"Crear merchant"** (deshabilitado hasta que las obligatorias estén listas).
- **Grid de cards** (3-col desktop, 1-col mobile). Cada card = `SetupCard`: icono + título + descripción corta + **badge de estado** arriba-derecha:
  - `Pendiente` (obligatoria sin completar) — tono `warn`/`muted`.
  - `Listo` (completa) — tono `success` con check.
  - **gated** ("Selecciona el venue primero", "Configura el merchant primero") — `muted`, card deshabilitada hasta cumplir el prerequisito.
- Card desbloqueada → click abre un **Drawer** (reusa `Drawer` de F1) con los campos de esa faceta; al guardar el drawer actualiza el estado **local** del panel (NO persiste por-card) y el badge pasa a `Listo`.
- **"Crear merchant"** → ensambla el payload de todas las cards llenas → **un POST** a `blumon/full-setup` → navega a `/merchants/:id` creado.

## 3. Cards (Blumon) → payload

| Card                     | Oblig.          | Gated por       | Editor (F5·A)                                                                 | → body de `full-setup`                                       |
| ------------------------ | --------------- | --------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Venue**                | ✅              | —               | Combobox de venues                                                            | `target = { type:'venue', id }`                              |
| **Terminal Blumon**      | ✅              | —               | serial · brand (PAX) · model (A910S) · environment                            | `serialNumber, brand, model, environment` (auto-fetch creds) |
| **Merchant**             | ✅              | Terminal Blumon | displayName · businessCategory?                                               | `displayName, businessCategory`                              |
| **Slot**                 | ✅              | Venue           | Combobox PRIMARY/SECONDARY/TERTIARY (default PRIMARY)                         | `accountSlot`                                                |
| **Costo del procesador** | opcional        | Merchant        | `CardRatesInput` (F2) + fixed/monthly                                         | `costStructureOverrides` **(tasas en %)**                    |
| **Precio al venue**      | opcional        | Merchant        | `CardRatesInput` (F2) + fixed/monthly                                         | `venuePricing` **(tasas en %)**                              |
| **Liquidación**          | default `Listo` | —               | días por tarjeta (déb/créd/amex/intl)                                         | `settlementConfig` (server defaults T+1/1/3/3 si se omite)   |
| **Reparto de ganancias** | opcional        | Merchant        | — _(sin editor en F5·A; default 100% Avoqado; se configura post-alta vía F2)_ | n/a (no está en `full-setup`)                                |
| **Terminales TPV**       | opcional        | Venue           | — _(sin editor en F5·A; el server auto-attacha por serial; extra después)_    | `additionalTerminalIds` (vacío en F5·A)                      |

> **Obligatorias = 4** (Venue, Terminal Blumon, Merchant, Slot). Liquidación arranca `Listo` con default. Reparto + Terminales quedan como cards "opcionales/después" sin editor en F5·A (se configuran con F2 y el detalle del merchant respectivamente).

## 4. ⚠️ Tasas en PORCENTAJE (footgun)

`blumon/full-setup` divide las tasas `/100` server-side → el body manda **porcentaje** (`2.5`), NO decimal. Distinto de los endpoints directos de F2 (que usan decimal 0..1). `CardRatesInput` maneja decimal internamente → **convertir `×100` al ensamblar** `costStructureOverrides`/`venuePricing`. Un test asienta esto (`2.5%` en UI → `2.5` en el body, no `0.025`).

## 5. Contratos de datos

| Acción                 | Método · ruta · body                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta Blumon (one-shot) | `POST /superadmin/merchant-accounts/blumon/full-setup` body §3 → `{ success, data: <merchant creado> }`                                                          |
| Opciones de venue      | `GET /dashboard/superadmin/venues` (legacy, envelope `{success,data}`) → `{id,name,slug}` para el Combobox _(merchants-local fetch; no importar feature venues)_ |

> `settlementConfig` sub-shape: `{ debitDays?, creditDays?, amexDays?, internationalDays?, otherDays? }` (+ dayType/cutoff — confirmar al implementar; el server pone defaults). En F5·A mando los días.

## 6. Arquitectura

```
src/features/merchants/
├── BlumonSetupPanel.tsx          # el panel full-screen (header + grid + estado local + submit)
├── BlumonSetupPanel.test.tsx
├── SetupCard.tsx                 # primitive de card (icono, título, desc, badge de estado, onClick)
└── setup-cards/                  # drawers por card: VenueCardDrawer, HardwareCardDrawer,
                                   #   MerchantCardDrawer, SlotCardDrawer, CostCardDrawer,
                                   #   PricingCardDrawer, SettlementCardDrawer
```

- **api.ts** (append): `fullSetupBlumon(payload)`, `fetchVenueOptions()`. Tipos: `BlumonFullSetupPayload`, `VenueOption`.
- **use-merchants.ts** (append): `useFullSetupBlumon` (invalida `MERCHANTS_QUERY_KEY`), `useVenueOptions`.
- **router.tsx**: ruta lazy `/merchants/new` → `BlumonSetupPanel`. (`/new` antes de `/:id`.)
- **MerchantsPage.tsx**: botón "+ Alta guiada (Blumon)" → `navigate('/merchants/new')`.
- **Estado local del panel:** un objeto `draft` con cada faceta; cada card-drawer lee/escribe su slice. La completitud (`Listo`/`Pendiente`) y el gating se computan en render desde `draft`.
- **Reuse:** `Drawer`, `Combobox`, `Button`, `Badge`, `CardRatesInput` (F2), `inspectApiError`, `toast`. `SetupCard` es nuevo (primitive del panel; será el template de F5·B AngelPay).

## 7. Estados / gating (computado en render, sin `useEffect`)

- `Venue`: siempre editable. Listo si `draft.venueId`.
- `Terminal Blumon`: siempre. Listo si serial+brand+model.
- `Merchant`: gated hasta Terminal Blumon listo. Listo si `displayName` (o se permite default → entonces Listo al abrir/confirmar).
- `Slot`: gated hasta Venue. Listo si slot elegido (default PRIMARY → Listo).
- `Costo`/`Precio`/`Reparto`: gated hasta Merchant. Opcionales (no cuentan para obligatorios).
- `Liquidación`: Listo por default (T+1/1/3/3).
- `Terminales`: gated hasta Venue. Opcional.
- CTA "Crear merchant" habilitado cuando las 4 obligatorias están `Listo`.

## 8. Submit

`useFullSetupBlumon` arma el body desde `draft`: `target`, `serialNumber/brand/model/environment`, `displayName/businessCategory`, `accountSlot`, y **si el operador llenó** Costo/Precio → `costStructureOverrides`/`venuePricing` (**×100**), Liquidación → `settlementConfig` (días). `additionalTerminalIds: []`. → POST. onSuccess: `toast.success`, `navigate('/merchants/' + data.id)`. onError: `inspectApiError` + toast + banner en el panel.

## 9. Server — `logAction` (aditivo, sin commit, deploy-first)

`fullSetupBlumonMerchant` (merchantAccount.controller.ts) hoy no registra ActivityLog. Agregar al final (tras crear): `logAction({ staffId:(req as any).user?.uid ?? null, action:'MERCHANT_ACCOUNT_PROVISIONED_BLUMON', entity:'MerchantAccount', entityId: merchantAccountId, data:{ venueId: target?.id, serialNumber, accountSlot, environment }, ipAddress:req.ip, userAgent: req.headers?.['user-agent'] })`. **Optional chaining en user-agent** (gotcha F1B-F4). Nunca loguear credenciales.

## 10. Testing

- **Integración (MSW):** `BlumonSetupPanel` — abrir → llenar Venue (mock `GET /dashboard/superadmin/venues`) + Terminal Blumon (serial/brand/model) + Merchant (displayName) → CTA "Crear merchant" se habilita → submit → **assert POST `blumon/full-setup` con `serialNumber`, `target:{type:'venue',id}`, `accountSlot:'PRIMARY'`** → navega. + un test del **% conversion** (llenar Costo a 2.5% → body `costStructureOverrides.debitRate === 2.5`).
- **Component:** `SetupCard` (badge Listo/Pendiente/gated; no click cuando gated).
- Mantener verdes F1–F4.

## 11. Riesgos / abiertos

- **SDK externo**: la 1ª corrida real necesita serial válido + acceso Blumon de prueba + server desplegado. UI/tests con mocks. Inherente — documentar en el banner del panel ("ambiente SANDBOX por default").
- `settlementConfig` dayType/cutoff exactos — confirmar al implementar (días son el core; server tiene defaults).
- Si crear config nueva con slot ≠ PRIMARY deja `primaryAccountId=''` (visto en el server) — en F5·A forzar/Default PRIMARY salvo que el venue ya tenga config; avisar si elige SECONDARY/TERTIARY sin primaria.
- `SetupCard` candidato a `shared/` cuando llegue F5·B (AngelPay) — por ahora vive en merchants.

## 12. Decomposición (para el plan)

- **F5·A-1:** api/hooks (`fullSetupBlumon` + `fetchVenueOptions` + hooks) + tipos + conversión %.
- **F5·A-2:** `SetupCard` (+ test) + `BlumonSetupPanel` shell (header, grid, progreso, gating, estado local) + wire route + botón en MerchantsPage.
- **F5·A-3:** los card-drawers (Venue, Hardware, Merchant, Slot, Costo, Precio, Liquidación) reusando CardRatesInput/Combobox.
- **F5·A-4:** submit (ensamble del body + POST) + test de integración + % test.
- **F5·A-5:** server `logAction` + docs + gate.
