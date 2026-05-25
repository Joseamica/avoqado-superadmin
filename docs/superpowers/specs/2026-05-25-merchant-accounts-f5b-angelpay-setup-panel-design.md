# Merchant Accounts — Fase 5·B: Panel de alta AngelPay · Diseño

> Estado: **propuesta para revisión**. Feature: consola superadmin (`avoqado-superadmin`), feature `merchants`.
> Fecha: 2026-05-25. Depende de F1–F5·A. Reglas: branch `develop`, sin worktree/branch, **sin commit**, sin `npm run format` global.

## 1. Objetivo

Alta guiada de un **merchant AngelPay** para un venue, en **una transacción** (`POST /superadmin/merchant-accounts/full-setup-angelpay`: login + merchant + slot + cost/pricing/settlement + terminales). **Mismo patrón de panel de cards** que F5·A (el screenshot "Nuevo merchant AngelPay" es el modelo literal).

## 2. Patrón — reusa F5·A

- **`AngelPaySetupPanel`** (full-screen, `fixed inset-0`) en `/merchants/new-angelpay`, lanzado desde un 3er botón **"+ Alta guiada (AngelPay)"** en `MerchantsPage` (junto a "+ Alta manual" y "+ Alta guiada (Blumon)").
- **Reusa** `SetupCard` (F5·A) y `fetchVenueOptions`/`useVenueOptions` (F5·A).
- **Reuse-or-promote:** extraer el `RatesDrawer` genérico de `BlumonSetupDrawers.tsx` a su propio `RatesDrawer.tsx` (es value-based, sin acoplar a Blumon) y que ambos paneles lo importen. (Actualizar el import en `BlumonSetupPanel`.)
- Drawers nuevos AngelPay (en `AngelPaySetupDrawers.tsx`): **Cuenta** (login), **Merchant** (create), **Slot** (fill/replace), **Settlement** (días + dayType + cutoff — la de Blumon era días-only, ésta es más rica).
- Header: X → `/merchants` · "Nuevo merchant AngelPay" · "{listas} de {oblig.} obligatorios" · CTA "Activar merchant" (deshabilitado hasta obligatorias listas).

## 3. Cards → body de `full-setup-angelpay`

| Card                     | Oblig.          | Gated    | Editor (F5·B)                                                                                                | → body                                   |
| ------------------------ | --------------- | -------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **Venue**                | ✅              | —        | Combobox de venues                                                                                           | `venueId`                                |
| **Cuenta AngelPay**      | ✅              | Venue    | **existente** (Combobox de `GET /venues/:id/angelpay-accounts`) · **nueva** (email + PIN 6díg + env QA/PROD) | `login` (discriminated `existing`/`new`) |
| **Merchant**             | ✅              | Cuenta   | crear: `externalMerchantId` (numérico) + `name` + `affiliation` + `displayName`                              | `merchant{ mode:'create', … }`           |
| **Slot**                 | ✅              | Venue    | `accountType` (PRIMARY/SEC/TER) + `mode` (fill/replace) + `replacedAccountId?`                               | `slot`                                   |
| **Costo del procesador** | opcional        | Merchant | `RatesDrawer` (**DECIMAL, sin ×100**)                                                                        | `cost` (+ `effectiveFrom`)               |
| **Precio al venue**      | opcional        | Merchant | `RatesDrawer` (**DECIMAL**)                                                                                  | `pricing` (+ `effectiveFrom`)            |
| **Liquidación**          | default `Listo` | —        | días por tarjeta + dayType + cutoff                                                                          | `settlement`                             |
| **Reparto de ganancias** | opcional        | Merchant | — _(sin editor; default 100% Avoqado; post-alta vía F2)_                                                     | n/a                                      |
| **Terminales TPV**       | opcional        | Venue    | — _(sin editor; atar después)_                                                                               | `terminalIds: []`                        |

> **Obligatorias = 4** (Venue, Cuenta, Merchant, Slot). Liquidación default `Listo`.

## 4. ⚠️ Footgun: DECIMAL (opuesto a Blumon)

`full-setup-angelpay` valida tasas `z.number().min(0).max(1)` = **DECIMAL 0..1**. `CardRatesInput` ya entrega decimal → **enviar tal cual, SIN ×100** (lo contrario de F5·A/Blumon que sí multiplica). Un test asienta esto (2.5% en UI → `0.025` en el body). Además `cost`/`pricing`/`settlement` requieren `effectiveFrom` (ISO) → `buildAngelPayPayload` lo agrega (`new Date().toISOString()`).

## 5. Alcance (decisiones aprobadas)

- **Merchant: sólo `mode:'create'`** (el `existing`/reuso de merchant descubierto vía TPV → diferido).
- **Slot: `fill` + `replace`** (con `replacedAccountId`); **cross-slot move** (`fromSlot`/`moveStrategy` swap/vacate) → diferido.
- **`aggregatorId`** opcional → diferido (no card en F5·B).
- **Login `new`**: se manda en el body del full-setup (`login.mode:'new'`); NO pre-creamos la cuenta. Login `existing`: pick de la lista.

## 6. Contratos de datos (`/api/v1/superadmin/*`)

| Acción                     | Método · ruta · body                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Alta (one-shot)            | `POST /superadmin/merchant-accounts/full-setup-angelpay` body §3 → `{ success, data: <merchant> }`                    |
| Cuentas AngelPay del venue | `GET /superadmin/venues/:venueId/angelpay-accounts` → lista `{id, email, status, environment}` para el modo existente |
| Venues (opciones)          | reusa `fetchVenueOptions` de F5·A (`GET /dashboard/superadmin/venues`)                                                |

> `settlement` body: `{ settlementDays (scalar = días débito como fallback), settlementDaysByCard:{DEBIT,CREDIT,AMEX,INTERNATIONAL}, settlementDayType, cutoffTime, cutoffTimezone, effectiveFrom }`.

## 7. Arquitectura

```
src/features/merchants/
├── AngelPaySetupPanel.tsx        # panel (reusa SetupCard; estado local AngelPayDraft)
├── AngelPaySetupPanel.test.tsx
├── AngelPaySetupDrawers.tsx      # CuentaDrawer, MerchantDrawer, SlotDrawer, SettlementDrawer (AngelPay)
├── angelpay-setup.ts             # AngelPayDraft + INITIAL + buildAngelPayPayload (puro, sin ×100, +effectiveFrom)
└── RatesDrawer.tsx               # extraído de BlumonSetupDrawers (genérico, ambos paneles)
```

- **api.ts** (append): `fullSetupAngelPay(payload)`, `fetchAngelPayAccounts(venueId)`. Tipos: `AngelPayFullSetupPayload`, `AngelPayAccountOption`.
- **use-merchants.ts** (append): `useFullSetupAngelPay`, `useAngelPayAccounts(venueId)`.
- **router.tsx**: ruta lazy `/merchants/new-angelpay` → `AngelPaySetupPanel`.
- **MerchantsPage.tsx**: 3er botón "+ Alta guiada (AngelPay)".
- **Refactor:** mover `RatesDrawer` a `RatesDrawer.tsx`; `BlumonSetupDrawers`/`BlumonSetupPanel` lo importan de ahí (sin cambiar comportamiento).
- `angelpay-setup.ts` separa lógica pura (HMR-safe, como `blumon-setup.ts`).

## 8. Server — `logAction` (aditivo, sin commit, deploy-first)

Verificar si `fullSetupAngelPayMerchant` (merchantAccount.controller.ts) ya registra ActivityLog; si **no**, agregar `logAction({ staffId:(req as any).user?.uid ?? null, action:'MERCHANT_ACCOUNT_PROVISIONED_ANGELPAY', entity:'MerchantAccount', entityId:<id creado>, data:{ venueId, accountSlot: slot.accountType, loginMode: login.mode, merchantMode: merchant.mode }, ipAddress:req.ip, userAgent: req.headers?.['user-agent'] })`. **Optional chaining** en user-agent. Nunca loguear el PIN ni credenciales.

## 9. Testing

- **Unit `buildAngelPayPayload`:** draft (login new + merchant create + cost 0.025) → body con `cost.debitRate === 0.025` (**sin** ×100), `login:{mode:'new',email,pin,environment}`, `merchant:{mode:'create',externalMerchantId,…}`, `slot:{accountType,mode:'fill'}`, `cost.effectiveFrom` presente. + caso login existing.
- **Component:** `CuentaDrawer` (toggle existente/nueva; PIN 6 dígitos validado), `SlotDrawer` (fill/replace + replacedAccountId requerido en replace).
- **Integración:** `AngelPaySetupPanel` render (título "Nuevo merchant AngelPay", 9 cards, CTA deshabilitado), gating (Cuenta locked sin venue).
- Mantener verdes F1–F5·A (incl. que el refactor de `RatesDrawer` no rompa Blumon).

## 10. Riesgos / abiertos

- **SDK externo**: login AngelPay (email+PIN) se valida server-side contra AngelPay; 1ª corrida real necesita credenciales de prueba. UI/tests con mocks.
- **PIN**: nunca loguear ni exponer; input `type=password`, no se persiste en el draft más de lo necesario.
- `settlement` scalar vs byCard — mando ambos (scalar = débito). Confirmar al implementar que el server acepta el combo.
- `replace` mode: `replacedAccountId` requerido (refine del schema) → validar en el SlotDrawer antes de habilitar "Activar".

## 11. Decomposición (para el plan)

- **F5·B-1:** extraer `RatesDrawer.tsx` (+ actualizar imports Blumon) · `angelpay-setup.ts` (`buildAngelPayPayload` puro + tests) · api/hooks.
- **F5·B-2:** `AngelPaySetupDrawers` (Cuenta/Merchant/Slot/Settlement) + `AngelPaySetupPanel` + wire route/botón + tests.
- **F5·B-3:** server `logAction` (verify/add) + docs + gate.
