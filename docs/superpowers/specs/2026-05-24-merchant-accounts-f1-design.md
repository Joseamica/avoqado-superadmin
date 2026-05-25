# Merchant Accounts — Fase 1 (Registro + legibilidad) · Diseño

> Estado: **propuesta para revisión**. Feature: consola superadmin (`avoqado-superadmin`).
> Fecha: 2026-05-24. Autor: Claude + Jose Antonio Amieva.
> Fases siguientes (F2–F5) tienen su propio spec cada una.

## 1. Objetivo

Construir la sección **Merchant accounts** (`/merchants`, hoy `disabled` en el sidebar) con un
único propósito en F1: **hacer legible la economía** de cada cuenta de pago —
proveedor → (agregador) → Avoqado → venue — y permitir el **CRUD de identidad**
(alta manual, editar identidad, activar/desactivar, borrar). Todo sobre endpoints
que **ya existen** en `avoqado-server`, más **un cambio aditivo mínimo** (§7).

No reescribimos el dashboard legacy ni duplicamos backend. Consumimos
`/api/v1/superadmin/*` (cookies HTTP-only, `withCredentials`).

## 2. Alcance

**Dentro de F1**

- Lista `/merchants` (DataTable: filtros, stats, export, realtime).
- Detalle `/merchants/:id` — **página seccionada, readiness-first**:
  - Cabecera (proveedor · ambiente · estado · acciones).
  - **Overview**: tira de _readiness_ + **flujo de dinero escalonado** (lectura).
  - Sección **Economía** (tabla "estado de resultados" por tarjeta, lectura).
  - Sección **Liquidación** (días D+N por tarjeta, lectura).
  - **Venues (slots)** — related-list: en qué slot (primary/secondary/tertiary) está cada venue.
  - **Terminales** — related-list: serial + hardware + ✓/✗ compatibilidad.
  - **Actividad** — activity log filtrado a la entidad.
- CRUD de identidad: alta manual, editar identidad (proveedor inmutable), toggle, borrar (con aviso de cascada).

**Fuera de F1** (fases siguientes)

- F2 — editar economía (ProviderCostStructure, VenuePricingStructure, MerchantRevenueShare, Aggregator/VenueCommission) + preview de margen.
- F3 — editar liquidación + proyección de fecha de depósito (HolidayCalendar).
- F4 — asignación de slots / routing (`VenuePaymentConfig`).
- F5 — wizards de alta Blumon/AngelPay (auto-fetch, full-setup, hardware-aware).
- EcommerceMerchant (card-not-present), reporte de revenue-share, incidencias de liquidación.

## 3. Modelo de dominio (recap)

```
PaymentProvider (Blumon · AngelPay · Menta…)  — code, type, configSchema, active
   │ 1:N
MerchantAccount  ──(aggregatorId?)──▶ Aggregator (Moneygiver)   ← la espina
   identidad (externalMerchantId, alias, displayName) · banco (CLABE, bankName, accountHolder)
   credentialsEncrypted · providerConfig · ambiente
   Blumon{serial,posId,merchantId,env} / AngelPay{afiliación, userAccount}
   ├─ ProviderCostStructure[]      lo que el PROVEEDOR nos cobra (por tarjeta, con vigencia)
   ├─ MerchantRevenueShare?  (1:1) split provider/agregador/Avoqado (report-time, opcional)
   ├─ SettlementConfiguration[]    días de liquidación (por tarjeta)
   ├─ VenuePricingStructure (vía venue) lo que le cobramos al venue (con margen)
   └─ ocupa SLOTS:  VenuePaymentConfig.{primary|secondary|tertiary}AccountId   (N:N venue↔merchant)
Terminal — venueId (1 venue) · assignedMerchantIds[] (N:N merchant) · brand/model (PAX|NEXGO)
```

**Hardware (regla del server):** `BLUMON→PAX`, `ANGELPAY→NEXGO`. El server rechaza
provisionar/asignar si el venue no tiene un terminal ACTIVO compatible (`IncompatibleDeviceError`, 409).
En F1 sólo lo **mostramos** (✓/✗ en la sección Terminales).

## 4. Decisiones de diseño (con la auditoría que las respalda)

1. **Lista → página de detalle con URL propia** (`/merchants/:id`). Patrón estándar (Stripe/Adyen): deep-link, back nativo. Drawer/modal **sólo** para acciones puntuales (toggle, borrar, editar identidad), nunca para contenido rico.
2. **Detalle seccionado, NO tabs (en F1).** Economía y Liquidación son registros chiquitos (4 tasas; ~5 filas). Esconderlos tras un tab = "click para ver un número" (anti-patrón) y pelea contra el objetivo de legibilidad. Tabs se justifican cuando cada faceta gane formularios de edición pesados → se **promueven** sección→tab en F2+.
3. **Readiness-first.** Para la mayoría de cuentas el valor diario del operador es "¿puede cobrar / tiene margen configurado?". El Overview abre con una tira de completitud (creds · costo · pricing · liquidación · slots · terminales), estilo _Requirements_ de Stripe y consistente con el patrón `SetupIcons` ya existente en `venues`.
4. **Economía protagonista del Overview** (no enterrada). Visualización elegida:
   - **Overview → flujo escalonado** (narra la cadena de un vistazo).
   - **Sección Economía → tabla "estado de resultados" por tarjeta** (densa, power-user).
5. **El caso DIRECTO es el default; el waterfall de agregador sólo cuando existe.** `MerchantRevenueShare` es opcional/aditivo. La viz degrada con elegancia (ver §9, 3 casos).
6. **Merchant-account-céntrico.** La vista venue-céntrica ("¿este venue está listo para cobrar?") vive en `venues` (usa `GET /merchant-accounts/payment-setup/summary`). Split deliberado.

## 5. Arquitectura frontend

Feature nuevo `src/features/merchants/` (Three-Level Rule, imports `@/`):

```
src/features/merchants/
├── api.ts                      # wrappers sobre /superadmin/* (merchant, providers, costs, pricing, revenue-share, settlement)
├── use-merchants.ts            # hooks TanStack Query (list, detail, economics bundle) + mutations
├── types.ts                    # tipos del dominio (MerchantAccount, ProviderCost, RevenueShare, Settlement…)
├── economics.ts                # cálculo puro de la cadena (3 casos) + tests (economics.test.ts)
├── readiness.ts                # reglas de los chips de readiness + tests
├── MerchantsPage.tsx           # lista (/merchants)
├── MerchantDetailPage.tsx      # detalle (/merchants/:id)
├── MerchantIdentityDrawer.tsx  # alta / editar identidad (Drawer)
├── MoneyFlow.tsx               # flujo escalonado (Overview)
├── EconomicsTable.tsx          # tabla por tarjeta (sección Economía)
├── ReadinessStrip.tsx          # tira de completitud (reusa tono SetupIcons)
└── sections/                   # VenueSlotsSection, TerminalsSection, SettlementSection, ActivitySection
```

- **Rutas** (`src/app/router.tsx`, todas `lazy()` + `<Suspense>`): `/merchants`, `/merchants/new`, `/merchants/:id`.
- **Sidebar** (`AppLayout.tsx`): quitar `disabled` de `/merchants`.
- **Reuso obligatorio:** `DataTable`, `Drawer`, `Button`/`IconButton`, `Badge`, `Combobox`, `FilterPill`/`MultiSelectFilterContent`, `QueryError`/`inspectApiError`, `datetime.ts`, `csv.ts`.
- **Realtime** (`use-realtime-invalidation.ts`): mapear `superadmin:merchant:updated` (+ cost/revenue/settlement) → invalidar `['superadmin','merchants', …]`.
- **Sin `useEffect` para estado derivado** (economía/readiness se computan en render desde los datos).

## 6. Contratos de datos (endpoints existentes)

Todos bajo `/api/v1/superadmin/*`. Sobre `getMerchantAccounts` el shape real (verificado en
`merchantAccount.service.ts`): por cuenta vienen `provider{id,code,name,type}`,
`angelpayUserAccount?{id,email,status,environment,venueId}`, `hasCredentials:boolean`,
`venues:[{id,name,slug}]`, `terminals:[{id,serialNumber}]`,
`_count:{costStructures, venueConfigs, terminals}`, además de identidad/banco/blumon/angelpay,
`displayName`, `alias`, `active`, `displayOrder`, `aggregatorId`, ambiente. (Las credenciales
encriptadas NO se exponen.)

| Uso                         | Método · ruta                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Lista                       | `GET /merchant-accounts?providerId&active` → `{success,data[],count}`                                                  |
| Detalle                     | `GET /merchant-accounts/:id` (`?includeCredentials=false`)                                                             |
| Terminales de la cuenta     | `GET /merchant-accounts/:id/terminals`                                                                                 |
| Proveedores (form + filtro) | `GET /payment-providers?active=true`                                                                                   |
| Costo proveedor             | `GET /cost-structures?merchantAccountId=…` _(confirmar param en impl)_                                                 |
| Pricing al venue            | `GET /venue-pricing/configs-by-merchant/:merchantAccountId` + `/venue-pricing/structures/active/:venueId/:accountType` |
| Split agregador             | `GET /merchant-revenue-shares/by-merchant?merchantAccountId=…` **(requiere §7)**                                       |
| Días liquidación            | `GET /settlement-configurations?merchantAccountId=…` **(requiere §7)**                                                 |
| Alta manual                 | `POST /merchant-accounts`                                                                                              |
| Editar identidad            | `PUT /merchant-accounts/:id`                                                                                           |
| Toggle                      | `PATCH /merchant-accounts/:id/toggle`                                                                                  |
| Borrar                      | `DELETE /merchant-accounts/:id`                                                                                        |

## 7. Cambio aditivo en `avoqado-server` (mínimo)

`merchant-revenue-shares` y `settlement-configurations` hoy sólo están montados en el router
`/api/v1/dashboard/superadmin/*` (legacy). Para que nuestra app use **un solo namespace**:

- En `src/routes/superadmin.routes.ts`: **2 imports + 2 `router.use`** →
  `/merchant-revenue-shares` y `/settlement-configurations` quedan también bajo `/api/v1/superadmin/*`.
- 100% aditivo: el dashboard legacy sigue usando `/dashboard/superadmin/*` intacto.
- **Activity log (no negociable):** verificar que los endpoints de mutación de merchant
  (`create/update/toggle/delete`) registren `logAction(...)` server-side; si falta, **agregarlo**
  (aditivo) — la trazabilidad es requisito. (El grep inicial no lo encontró en el controller; confirmar en service.)
- Respetar **deploy-order**: server primero, luego el frontend.

> Decisión ya tomada con el usuario: "cadena completa" + este cambio aditivo.

## 8. Lógica de readiness (`readiness.ts`)

Cada chip = `ok` | `missing` | `unknown`, tonos como `SetupIcons`:

| Chip            | `ok` cuando                                                       |
| --------------- | ----------------------------------------------------------------- |
| Credenciales    | `hasCredentials === true`                                         |
| Costo proveedor | existe `ProviderCostStructure` activa vigente                     |
| Pricing venue   | existe `VenuePricingStructure` activa para los slots que ocupa    |
| Liquidación     | existe `SettlementConfiguration` (al menos débito/crédito)        |
| Slots           | `_count.venueConfigs > 0`                                         |
| Terminales      | `_count.terminals > 0` **y** hardware compatible con el proveedor |

`missing` se explica con copy accionable ("Sin estructura de costos — no podemos calcular margen").

## 9. Cálculo de economía (`economics.ts`, puro + testeado)

Entrada: `ProviderCostStructure` (costo), `VenuePricingStructure`/`aggregatorPrice` (lo que se cobra),
`MerchantRevenueShare?` (shares + taxRate), `Aggregator?`/`VenueCommission?`. **Tres casos:**

1. **Sin `MerchantRevenueShare`** → `margen = precioVenue − costo`, **todo Avoqado** (legacy).
2. **`aggregatorPrice = null`** → venta **directa con split**: 1 margen provider↔Avoqado, `avoqadoShareOfProviderMargin`.
3. **`aggregatorPrice` poblado** → vía **agregador** (flujo Moneygiver, 2 márgenes/2 splits):
   - Proveedor retiene `tasa × monto` + IVA (16% de la comisión) → neto al agregador.
   - Agregador cobra `VenueCommission.rate` (sin IVA) → dispersa al venue.
   - La comisión del agregador se reparte Avoqado/agregador (EXTERNAL 70/30 · AGGREGATOR 30/70, vía `avoqadoShareOfAggregatorMargin`).

Todo **por tipo de tarjeta** (Débito/Crédito/AMEX/Internacional). `includesTax`/`taxRate` por estructura
(null = tratar como `true`, comportamiento histórico). Cálculo **report-time** (no toca el proceso de pago).
Tests: los 3 casos × tarjetas + bordes (sin pricing, tasas con/ sin IVA).

## 10. Layouts (ASCII de referencia)

**Lista `/merchants`**

```
Merchant accounts                                          [+ Alta manual]
[buscar…]  [Proveedor ▾] [Estado ▾] [Ambiente ▾] [Costos ▾] [Creds ▾]   [Export CSV]
Total 24 · Activas 19 · Sin costos 5
┌────────────────────────────────────────────────────────────────────────────┐
│ Cuenta              Prov.   Amb.   ID/Serial    Estado  Listo        ··· │
│ ● Cuenta Principal  Blumon  SBX    9814275·2841 Activa  ●●●○●●   [↗][⋯] │
│ ● Sucursal Centro   AngelPay PROD  88431        Activa  ●●●●●●   [↗][⋯] │
└────────────────────────────────────────────────────────────────────────────┘
(activas primero, luego inactivas)
```

**Detalle `/merchants/:id`** (seccionado, readiness-first)

```
← Merchants
● Blumon · Cuenta Principal      [SANDBOX][Activa]        [Editar][Desactivar][Borrar]
ext 9814275 · serial 2841548417 · posId 376 · CLABE ····4821

Readiness:  ✓ Creds  ✓ Costo  ✗ Pricing  ✓ Liquidación  ✓ Slots(2)  ✓ Terminales(1)

Flujo de dinero (débito ▾)            Identidad & banco
 Cliente paga          $100.00         BBVA · José A.
 → Blumon 2.5%+IVA     −$2.90          creds ✓ · displayOrder 0
 Neto al agregador     $97.10
 → Moneygiver 7%       −$6.80          Liquidación
 Venue recibe          $90.30           D+1 déb/créd · D+3 amex/intl · hábiles · 23:00
 ↳ Avoqado 70% $4.76 · MG 30% $2.04

Economía (por tarjeta)  ── tabla estado de resultados (Déb/Créd/AMEX/Intl) ──
Venues (slots)          ── Doña Simona PRIMARY · Tacos Güero SECONDARY ──
Terminales              ── PAX A910S ·2841  ✓ compatible ──
Actividad               ── activity log de esta cuenta ──
```

## 11. CRUD de identidad

- **Alta manual** (`MerchantIdentityDrawer`): `provider` (Combobox, **inmutable** tras crear),
  `externalMerchantId`, `alias`, `displayName`, banco (`clabeNumber`/`bankName`/`accountHolder`),
  `displayOrder`, `active`, `providerConfig?`; campos Blumon/AngelPay condicionales al proveedor.
  Credenciales **opcionales** (Blumon puede quedar "pending"). _El alta guiada completa (auto-fetch / full-setup) es F5._
- **Editar identidad**: igual, proveedor bloqueado.
- **Toggle**: `PATCH …/toggle`, optimistic + invalidación.
- **Borrar**: confirm con **aviso de cascada** (borra cost structures + venue payment configs); listar qué se elimina.
- Validación con **zod**; errores de mutación vía `toast.error(inspectApiError(...))`.

## 12. Errores · datetime · i18n

- Toda query → `QueryError` + `inspectApiError`. Mutaciones → `toast.error`. Nada de `<div>No pudimos…</div>`.
- Fechas vía `datetime.ts` (default `America/Mexico_City`; usar `venue.timezone` cuando exista; headers con `timezoneShort`).
- Montos: `tabular-nums`, alineados a la derecha.

## 13. Testing

- **Unit:** `economics.ts` (3 casos × tarjetas), `readiness.ts`, validadores zod.
- **Component:** `MoneyFlow` (directo vs agregador), `EconomicsTable`, `ReadinessStrip`.
- **Integration (RTL+MSW):** `MerchantsPage` (lista+filtros), `MerchantDetailPage` (detalle+economía), alta/editar/toggle/borrar (handlers MSW para los endpoints de §6).
- **E2E (Playwright):** happy path lista → detalle → editar identidad.
- Coverage ≥ umbral (60/55). Verificación en DB local (`psql`) sólo si se prueba contra API real.

## 14. Design system / impeccable

- Dark default. `Button`/`IconButton`/`Badge`/`DataTable`/`Combobox`/`Drawer` únicos; sin clases inline de botón ni badges a mano. Readiness reusa tonos de `SetupIcons` (gris elevado para "ok", nunca blanco).
- Empty states que enseñan ("No hay merchant accounts. Crea la primera con + Alta manual").
- Mobile-friendly (tablas en `overflow-x-auto`, touch targets ≥ 36px).
- `impeccable:frontend-design` antes de construir cada pantalla; `impeccable:polish` antes de cerrar; `impeccable:audit` antes de pushear (arreglar ≥ high en el mismo PR).

## 15. Docs a mantener en sync (mismo PR)

- **CHANGELOG.md** → `[Unreleased] · Added`: "Merchant accounts (F1): listado + detalle legible + CRUD de identidad".
- **README.md** → nueva página top-level `/merchants` + (si aplica) el cambio de namespace del server.
- **CLAUDE.md** (server) → documentar que `merchant-revenue-shares` + `settlement-configurations` ahora también viven en `/api/v1/superadmin/*`.

## 16. Riesgos / preguntas abiertas

- **Params exactos** de `cost-structures` / `venue-pricing` por merchant — confirmar al implementar (§6 marca supuestos).
- **N+1 de lectura**: el detalle agrega costo+pricing+revenue-share+settlement; evaluar un endpoint agregador (existe `payment-setup/summary`) vs varias queries en paralelo. F1: paralelo con TanStack; optimizar si pesa.
- **`logAction` en mutaciones de merchant**: confirmar/instrumentar server-side (§7).
- Pricing depende del slot/venue (no es del merchant solo) → en el Overview mostramos pricing **por venue ocupado**; si ocupa varios con tarifas distintas, listamos por venue (no un único número).

```

```
