# Merchant Accounts — Fase 4: Asignación de slots (VenuePaymentConfig) · Diseño

> Estado: **propuesta para revisión**. Feature: consola superadmin (`avoqado-superadmin`), **feature `venues`** (venue-céntrico).
> Fecha: 2026-05-25. Depende de F1–F3. Reglas: branch `develop`, sin worktree/branch, **sin commit**, sin `npm run format` global.

## 1. Objetivo

Llenar el placeholder `/venues/:venueId/merchant` con la pantalla real para **asignar merchant accounts a los slots de un venue** (`VenuePaymentConfig`: primary / secondary / tertiary) — el corazón editable del multi-merchant. Hoy el detalle del merchant ya muestra esos slots en read-only (F1); F4 los hace editables desde el venue.

## 2. Alcance

**Dentro de F4**

- Pantalla `VenuePaymentConfigPage` (feature `venues`) en `/venues/:venueId/merchant` (reemplaza el `VenueResourcePlaceholder resource="merchant"`).
- Elegir **Primary** (requerido) / **Secondary** / **Tertiary** (opcionales) de la lista de merchant accounts + **preferredProcessor**.
- **Hint de compatibilidad de hardware** (best-effort): por slot elegido, ✓/⚠ si el venue tiene un terminal ACTIVO compatible con el proveedor (BLUMON→PAX, ANGELPAY→NEXGO). No bloquea guardar.
- **Server (aditivo, deploy-first):** `logAction` en create/update de venuePaymentConfig.

**Fuera de F4**

- `routingRules` freeform (JSON: BIN routing, amount thresholds) — fase posterior; F4 cubre slots + preferredProcessor.
- `/venues/:venueId/pricing` (VenuePricingStructure venue-céntrico) — F2 ya edita pricing merchant-céntrico; el placeholder de pricing se aborda aparte si se quiere la entrada venue-céntrica.
- Asignación terminal↔merchant (`assignedMerchantIds`), F5 wizards.

## 3. Decisiones de diseño

1. **Venue-céntrico**, en `features/venues/`, llena el placeholder. Es coherente con el modelo (`VenuePaymentConfig.venueId` único) y la decisión de F1.
2. **Editar en sitio** (igual F2/F3): `POST /venue-pricing/config` si el venue no tiene config, `PUT /venue-pricing/config/:venueId` si ya tiene.
3. **Selector de cuentas local al feature `venues`** (`fetchMerchantAccountOptions` en `venues/api.ts` → `GET /superadmin/merchant-accounts?active=true`). NO se importa del feature `merchants` (regla de aislamiento). _Nota: candidato a promover a `shared/` — terminals + merchants + venues lo usan; se deja como deuda explícita._
4. **Compat hint best-effort**: fetch local de terminales del venue para señalar incompatibilidades; si el endpoint/datos no están disponibles, degrada a mostrar sólo el proveedor (sin ⚠).

## 4. Contratos de datos (todos `/api/v1/superadmin/*`)

| Acción                             | Método · ruta · body                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config actual (load)               | `GET /venue-pricing/config/:venueId` → config o null (`{ primaryAccountId, secondaryAccountId, tertiaryAccountId, routingRules, preferredProcessor }`)         |
| Crear config                       | `POST /venue-pricing/config` body `{ venueId, primaryAccountId, secondaryAccountId?, tertiaryAccountId?, preferredProcessor? }` _(routingRules omitido en F4)_ |
| Actualizar config                  | `PUT /venue-pricing/config/:venueId` body `{ primaryAccountId, secondaryAccountId?, tertiaryAccountId?, preferredProcessor? }`                                 |
| Opciones de cuentas                | `GET /superadmin/merchant-accounts?active=true` → mapear a `{ id, label, providerCode, providerName, environment }`                                            |
| Terminales del venue (compat hint) | `GET /superadmin/terminals?venueId=` → `{ brand, status }[]` _(confirmar filtro `venueId` al implementar; si no, fetch + filtrar client-side)_                 |

> `preferredProcessor` enum = `AUTO | LEGACY | MENTA | CLIP | BANK_DIRECT` (default `AUTO`).

## 5. Arquitectura

```
src/features/venues/
├── VenuePaymentConfigPage.tsx       # pantalla en /venues/:venueId/merchant
└── VenuePaymentConfigPage.test.tsx
```

- **venues/api.ts** (append): `fetchVenuePaymentConfig(venueId)`, `saveVenuePaymentConfig(venueId, existing, body)`, `fetchMerchantAccountOptions()`, `fetchVenueTerminalBrands(venueId)` (compat). Tipos: `VenuePaymentConfig`, `MerchantAccountOption`, `PreferredProcessor`.
- **venues/use-venues.ts** (append): `useVenuePaymentConfig(venueId)`, `useSaveVenuePaymentConfig`, `useMerchantAccountOptions`, `useVenueTerminalBrands(venueId)`.
- **router.tsx**: reemplazar `<VenueResourcePlaceholder resource="merchant" />` por `<VenuePaymentConfigPage />` (lazy) en la ruta `/venues/:venueId/merchant`. Dejar los otros placeholders intactos.
- **Provider→brand map** (compat): `{ BLUMON: ['PAX'], ANGELPAY: ['NEXGO'] }`; proveedores no listados = sin restricción. Helper puro `isProviderCompatible(providerCode, brands)` + test.

## 6. Pantalla (UI)

- Shell estilo `VenueResourcePlaceholder` (back link + header con nombre/slug del venue). Reusa `useVenueDetail`.
- **3 slots** (Primary requerido, Secondary/Tertiary opcionales): cada uno un `Combobox` de cuentas (label = displayName/alias/externalMerchantId; description = proveedor + ambiente; `allowCustomValue=false`; incluye opción "— ninguno —" para secondary/tertiary). Bajo cada slot elegido: chip del proveedor + ✓/⚠ compat.
- **preferredProcessor**: `Combobox` (default AUTO).
- Validación: primary obligatorio; secondary/tertiary no pueden repetir la misma cuenta que primary (zod o check inline) — aviso claro si se repite.
- **Guardar** (`<Button>`): POST/PUT; `toast` + `inspectApiError`; al éxito invalida venue detail + lista de venues (para refrescar el SetupIcon "merchant") y navega a `/venues/:venueId`.
- **Empty state**: si no hay config, arranca con todo vacío + copy "Este venue aún no tiene cuentas asignadas; elige al menos la principal".
- Loading / `QueryError` consistentes con el resto.

## 7. Server — `logAction` (aditivo, sin commit, deploy-first)

`venuePricing.controller.ts` (donde viven `createVenuePaymentConfig` / `updateVenuePaymentConfig`): `await logAction({ staffId: (req as any).user?.uid ?? null, action: 'VENUE_PAYMENT_CONFIG_CREATED'|'VENUE_PAYMENT_CONFIG_UPDATED', entity: 'VenuePaymentConfig', entityId: venueId, data: { venueId, primaryAccountId, secondaryAccountId, tertiaryAccountId, preferredProcessor }, ipAddress: req.ip, userAgent: req.headers?.['user-agent'] })`. **Usar `req.headers?.['user-agent']`** (optional chaining — ver gotcha de F1B/F2/F3). Sólo ese archivo.

## 8. Testing

- **Unit:** `isProviderCompatible` (BLUMON+PAX ✓, BLUMON+NEXGO ⚠, provider desconocido ✓).
- **Integración (MSW):** `VenuePaymentConfigPage` — load venue + config (con primary) + opciones → cambiar primary → **PUT con el `primaryAccountId` correcto** + toast/navega. Caso sin config → POST. Validación: secondary == primary → error, no request.
- Mantener verdes F1–F3.

## 9. Riesgos / abiertos

- Filtro `?venueId` en `/superadmin/terminals` para el compat hint — confirmar al implementar; fallback: fetch sin filtro + filtrar client-side, o degradar a sólo-proveedor.
- Selector de cuentas duplicado (terminals tiene uno, ahora venues otro) — deuda; promover a `shared/` cuando se aborde un refactor (no en F4).
- El config guarda `routingRules` existente intacto en updates (no lo mandamos → el server lo deja igual si su update es parcial; **confirmar** que `updateVenuePaymentConfig` no lo borra al recibir `undefined`; si lo borra, releer y reenviar el `routingRules` actual).

## 10. Decomposición (para el plan)

- **F4·A:** `venues/api.ts` + `use-venues.ts` (config + options + terminal brands) + `isProviderCompatible` (+ test) · `VenuePaymentConfigPage` (+ test) · wire en router (reemplazar placeholder).
- **F4·B:** server `logAction` en venuePaymentConfig · docs + gate.
