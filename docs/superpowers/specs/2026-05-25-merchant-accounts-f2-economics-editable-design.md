# Merchant Accounts — Fase 2: Economía editable · Diseño

> Estado: **propuesta para revisión**. Feature: consola superadmin (`avoqado-superadmin`).
> Fecha: 2026-05-25. Depende de F1 (A+B). Sigue las mismas reglas: branch `develop`, sin worktree/branch, sin commit (queda para revisión del usuario), sin `npm run format` global.

## 1. Objetivo

Volver **editable** la economía que F1 ya hace legible: lo que el proveedor cobra, lo que paga el venue, y el split provider/agregador/Avoqado — con **preview de margen en vivo** (reusa `economics.ts`). Sobre endpoints existentes de `/api/v1/superadmin/*`.

## 2. Alcance

**Dentro de F2**

- Editar **`ProviderCostStructure`** (costo del proveedor, nivel merchant): 4 tasas + `includesTax` + `fixedCostPerTransaction`.
- Editar **`MerchantRevenueShare`** (split, nivel merchant): toggle directa ⇄ agregador; `aggregatorPrice` (4 tasas, nullable), `avoqadoShareOfProviderMargin`, `avoqadoShareOfAggregatorMargin`, `taxRate`.
- Editar **`VenuePricingStructure`** (lo que paga el venue, por `(venue, slot)`): 4 tasas + `includesTax` + `fixedFeePerTransaction` + `monthlyServiceFee`. Desde la sección _Venues_ del detalle.
- **Preview de margen en vivo** vía `economics.ts`.
- **Server (aditivo, sin commit):** `logAction` en las mutaciones de cost-structures / venue-pricing / merchant-revenue-shares.

**Fuera de F2**

- F2·C catálogo de agregadores (`Aggregator` baseFees + `VenueCommission`).
- Versionado/historial de tarifas (se edita **en sitio**; ver §4).
- Slots/routing (F4), wizards de alta (F5), edición de identidad (ya es F1·B).

## 3. Decisiones de diseño

1. **Editar en sitio** (decisión del usuario): si existe la estructura **activa** → `PUT /:id`; si no existe → `POST` con `effectiveFrom = ahora`. No se versiona ni se piden fechas de vigencia en F2.
2. **Dos drawers** (reusan el patrón de `MerchantIdentityDrawer`):
   - `EditEconomicsDrawer` (nivel merchant): costo + revenue-share + preview. Se abre desde la sección _Economía_ del detalle.
   - `EditVenuePricingDrawer` (por venue+slot): pricing + preview. Se abre desde cada fila de _Venues_.
3. **Reuse-or-promote:** `CardRatesInput` (4 inputs déb/créd/amex/intl, en **porcentaje**) y `MarginPreview` (envuelve `economics.ts`) como componentes del feature — usados por ambos drawers.
4. **Porcentajes en UI, decimales en API.** El operador piensa en `1.5%`; el backend guarda `0.015`. `CardRatesInput` muestra/edita **porcentaje** y convierte (`÷100` al guardar, `×100` al cargar). Igual para los `avoqadoShareOf…` (50% ⇄ 0.5).
5. **Preview contextual:** en `EditEconomicsDrawer` el preview es pleno para el caso **agregador** (costo → aggregatorPrice → margen provider-side); para directo muestra "el margen se define en el pricing por venue". En `EditVenuePricingDrawer` muestra el **margen directo** (precio − costo) leyendo el costo activo del merchant.

## 4. Contratos de datos (endpoints existentes)

Todos `/api/v1/superadmin/*`. **Tasas en decimal 0..1** en el wire.

| Acción                | Método · ruta · body                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Costo activo (load)   | `GET /cost-structures/active/:merchantAccountId` _(F1 ya tiene `fetchActiveCost`)_                                                                                                                                                                                                                                             |
| Guardar costo         | `PUT /cost-structures/:id` o `POST /cost-structures` body `{ merchantAccountId, debitRate, creditRate, amexRate, internationalRate, includesTax, taxRate, fixedCostPerTransaction?, effectiveFrom }`                                                                                                                           |
| Split (load)          | `GET /merchant-revenue-shares/by-merchant?merchantAccountId=` _(F1 ya tiene `fetchRevenueShare`)_                                                                                                                                                                                                                              |
| Guardar split         | `POST /merchant-revenue-shares` (si no existe) / `PUT /merchant-revenue-shares/:id` body `{ aggregatorPrice: CardRates\|null, aggregatorPriceIncludesTax, avoqadoShareOfProviderMargin, avoqadoShareOfAggregatorMargin?, taxRate, active }` _(zod del backend ya verificado)_                                                  |
| Pricing activo (load) | `GET /venue-pricing/structures/active/:venueId/:accountType`                                                                                                                                                                                                                                                                   |
| Guardar pricing       | `PUT /venue-pricing/structures/:id` o `POST /venue-pricing/structures` body `{ venueId, accountType, debitRate, creditRate, amexRate, internationalRate, includesTax, taxRate, fixedFeePerTransaction?, monthlyServiceFee?, effectiveFrom }` _(confirmar nombres exactos leyendo `venuePricing.controller.ts` al implementar)_ |

> El `effectiveFrom` para POST = `new Date().toISOString()`. El `accountType` (PRIMARY/SECONDARY/TERTIARY) viene del slot que ocupa la cuenta en ese venue (ya disponible en `MerchantVenueConfig.slot` de F1).

## 5. Arquitectura frontend

```
src/features/merchants/
├── CardRatesInput.tsx          # 4 inputs (déb/créd/amex/intl) en %, value=CardRates decimal, onChange
├── CardRatesInput.test.tsx     # %↔decimal conversion
├── MarginPreview.tsx           # envuelve economics.ts; muestra margen por tarjeta
├── EditEconomicsDrawer.tsx     # costo + revenue-share + MarginPreview
├── EditEconomicsDrawer.test.tsx
├── EditVenuePricingDrawer.tsx  # pricing por (venue, slot) + MarginPreview
└── EditVenuePricingDrawer.test.tsx
```

- **api.ts** (append): `saveCost`, `saveRevenueShare`, `getActiveVenuePricing`, `saveVenuePricing` (+ payload types). Reusa `fetchActiveCost`/`fetchRevenueShare`.
- **use-merchants.ts** (append): `useSaveCost`, `useSaveRevenueShare`, `useSaveVenuePricing` (invalida `MERCHANTS_QUERY_KEY`).
- **MerchantDetailPage.tsx**: botón "Editar economía" en la sección Economía (abre `EditEconomicsDrawer`); botón/acción "Editar pricing" por fila en _Venues_ (abre `EditVenuePricingDrawer` con `venueId`+`slot`).
- **economics.ts**: sin cambios (ya cubre los modos). `MarginPreview` arma el `EconomicsInput` desde el estado del form.

## 6. Conversión % ↔ decimal (`CardRatesInput`)

- Prop `value: CardRates` (decimal). Render = `value[card] * 100` con sufijo `%`.
- `onChange(card, pctString)` → `decimal = parseFloat(pct)/100`; valida `0 ≤ pct ≤ 100`.
- Inputs `inputMode="decimal"`, `tabular-nums`. Un input vacío = 0. Reusa el `inputCls` de F1·B (o se promueve a un primitive `Input` si crece — ver §9).

## 7. Server — `logAction` (aditivo, sin commit, deploy-first)

Igual patrón que F1·B (`(req as any).user?.uid`, best-effort). En:

- `providerCostStructure.controller.ts` → `COST_STRUCTURE_CREATED/UPDATED` (entity `ProviderCostStructure`, data: rates + merchantAccountId; **sin** secretos).
- `venuePricing.controller.ts` → `VENUE_PRICING_CREATED/UPDATED` (entity `VenuePricingStructure`, data: venueId, accountType, rates).
- `merchantRevenueShare.controller.ts` → `REVENUE_SHARE_CREATED/UPDATED` (entity `MerchantRevenueShare`, data: merchantAccountId, mode directa/agregador).
  Editar **sólo** esos 3 controllers; no tocar el árbol sucio del usuario.

## 8. Errores · validación · diseño

- Mutaciones → `toast` + `inspectApiError`; error inline `role="alert"` (igual que F1·B).
- zod: tasas 0..100 (%), shares 0..100 (%). `aggregatorPrice` sólo requerido en modo agregador.
- Primitivos únicos (`Drawer`/`Button`/`Combobox`/`Badge`), tokens, `tabular-nums`, montos a la derecha. `impeccable:audit` antes de cerrar.

## 9. Testing

- **Unit:** `CardRatesInput` (%↔decimal, bordes), `MarginPreview` (los modos contra `economics.ts`).
- **Integración (MSW):** `EditEconomicsDrawer` (cargar activos → editar costo y split → `PUT`/`POST` con el decimal correcto → toast); `EditVenuePricingDrawer` (cargar pricing del `(venue,slot)` → guardar). Aserción clave: **un `2.5%` en UI sale como `0.025` en el body**.
- Mantener verdes los tests de F1.

## 10. Riesgos / abiertos

- Nombres exactos del body de venue-pricing POST/PUT → confirmar en `venuePricing.controller.ts` al implementar (§4 marca el supuesto).
- POST-si-no-existe en cost necesita `effectiveFrom`; si ya hay una estructura activa con la fecha de hoy, hacer `PUT` (no chocar con el unique `(merchantAccountId, effectiveFrom)`).
- Si los forms crecen (más campos), **promover** un primitive `Input`/`Field` (hoy `inputCls` es inline en el drawer de F1·B) — candidato de refactor en F2 o F3.
- El preview directo en `EditEconomicsDrawer` necesita un venue pricing para mostrar margen; por eso ahí el preview se enfoca en el caso agregador y deriva el directo al drawer de pricing.

## 11. Decomposición de implementación (para el plan)

Sugerido en 2 partes shippables:

- **F2·A:** `CardRatesInput` + `MarginPreview` + `EditEconomicsDrawer` (costo + split) + hooks/api + wire en Economía + logAction (cost + revenue-share).
- **F2·B:** `EditVenuePricingDrawer` + api/hook venue-pricing + wire en _Venues_ + logAction (venue-pricing).
