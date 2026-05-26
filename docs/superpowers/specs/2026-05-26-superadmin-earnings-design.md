# Diseño — Página "Ganancias" (Superadmin)

- **Fecha:** 2026-05-26
- **Estado:** Diseño aprobado (pendiente revisión del spec escrito)
- **Repos:** `avoqado-superadmin` (frontend), `avoqado-server` (backend, aditivo)
- **Ruta nueva:** `/earnings` · **Endpoints nuevos:** `/api/v1/superadmin/earnings/*`

---

## 1. Objetivo

Una página para que el dueño/operador de Avoqado vea **cuánto dinero está ganando la plataforma**, filtrable por rango de fechas, desglosado por **negocio (venue)**, **merchant account**, **proveedor** y **tipo de tarjeta**, con tendencia en el tiempo y export.

"Ganancia" = los **dos buckets** de ingreso de Avoqado, combinados:

1. **Terminales (TPV).** El spread por transacción en persona: lo que se le cobra al venue − lo que cobra el proveedor. Ya persistido en `TransactionCost.grossProfit`.
2. **Cobros en línea (e-commerce).** La comisión de plataforma sobre cada checkout online. Persistido en `CheckoutSession.applicationFeeCents` (centavos).

## 2. Alcance

**Incluye (v1):**

- Endpoint(s) `/superadmin/earnings/*` que combinan terminal + online.
- KPIs de cabecera, tendencia (recharts), 4 desgloses en tablas, export CSV.
- Filtro por `DateRangePicker` (con presets). Default: mes en curso.

**Fuera (v1):**

- Ajuste de la ganancia al **neto post-agregador** (ver §7 — se reporta ganancia **bruta** y se etiqueta como tal).
- Conciliación de liquidaciones / payouts.
- Invalidación realtime (opcional, §8).
- ActivityLog: no aplica — la página es **sólo lectura**, no muta estado.

## 3. Restricción dura — namespace `/superadmin/*` (ver CLAUDE.md "Namespace rule")

Esta feature es el **caso modelo** de la regla:

- Endpoints **nuevos** nacen en `/superadmin/earnings/*`. **Nunca** se toca `/dashboard/superadmin/*`.
- El backend **reusa tal cual** los services compartidos que ya existen y sirven (`paymentAnalyticsService`) cuando el comportamiento es idéntico, y **crea funciones nuevas** sólo para lo que no existe (online, desgloses completos sin `LIMIT`, por-merchant).
- **Referencia legacy:** `avoqado-web-dashboard/src/pages/Superadmin/ProfitAnalyticsDashboard.tsx` y `paymentProvider.service.ts` (líneas ~974-1016) muestran el contrato de datos del profit terminal — se lee como referencia, no se consume.

## 4. Backend (`avoqado-server`, aditivo)

### 4.1 Fuentes de datos

| Bucket   | Tabla                                    | Campo de ganancia                 | Dimensiones disponibles                                                                            |
| -------- | ---------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Terminal | `TransactionCost`                        | `grossProfit` (Decimal)           | `transactionType` (tarjeta), `merchantAccountId`→`PaymentProvider`, `payment.venueId`, `createdAt` |
| Online   | `CheckoutSession` (`status = COMPLETED`) | `applicationFeeCents` (Int, ÷100) | `ecommerceMerchant`→`venueId` + `provider`, `createdAt`                                            |

Montos en `Decimal`; online en **centavos** → convertir a MXN dividiendo entre 100. Moneda: MXN.

### 4.2 Endpoints nuevos

Montados en `src/routes/superadmin.routes.ts` → `router.use('/earnings', earningsRoutes)`. Guard SUPERADMIN heredado del router padre (automático).

```
GET /superadmin/earnings/summary?startDate&endDate
GET /superadmin/earnings/time-series?startDate&endDate&granularity=daily|weekly|monthly
GET /superadmin/earnings/export?startDate&endDate
```

**`reuse` vs `create` (aplicando la regla):**

| Pieza                                                   | Acción     | Detalle                                                                                 |
| ------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| Totales terminal + `byCardType`                         | **reuse**  | Llamar `paymentAnalyticsService.getProfitMetrics()` sin modificarlo                     |
| Tendencia terminal                                      | **reuse**  | `paymentAnalyticsService.getProfitTimeSeries()`                                         |
| Desglose **por venue COMPLETO** (sin `LIMIT 10`)        | **create** | El de analytics es top-10; aquí se necesita todo → query nueva en `earnings.service.ts` |
| Desglose **por merchant account**                       | **create** | No existe en analytics                                                                  |
| Agregación **online** (fees por venue / canal / tiempo) | **create** | No existe; referenciar el groupBy de `ecommerceMerchants.superadmin.controller.ts`      |
| Merge terminal+online (por venue, totales, tendencia)   | **create** | Orquestación en `earnings.service.ts`                                                   |

### 4.3 Shape de `GET /superadmin/earnings/summary`

```ts
{
  success: true,
  data: {
    range: { startDate: ISO, endDate: ISO },
    totals: {
      grossProfit: number,      // terminalProfit + onlineFees  (el número héroe)
      terminalProfit: number,   // Σ TransactionCost.grossProfit
      onlineFees: number,       // Σ applicationFeeCents / 100
      volume: number,           // Σ montos terminal + online
      transactions: number,     // # terminal + # online COMPLETED
      averageMargin: number,    // terminalProfit / terminalVenueCharge (sólo terminal)
    },
    byVenue: [{ venueId, venueName, profit, terminalProfit, onlineFees, volume, transactions }],
    byMerchant: [{ merchantAccountId, alias, providerCode, profit, volume, transactions }],   // terminal
    byProvider: [{ providerId, providerCode, providerName, volume, cost, transactions }],      // terminal
    byCardType: [{ type, transactions, volume, profit, margin }],                              // terminal
    byChannel: [{ ecommerceMerchantId, label, providerCode, fees, volume, transactions }],     // online
  }
}
```

`time-series` devuelve `[{ date, terminalProfit, onlineFees, profit }]` (merge por bucket). `export` devuelve filas a nivel transacción para CSV (reusa/extiende `exportProfitData` + agrega filas online).

### 4.4 Archivos backend nuevos

- `src/services/superadmin/earnings.service.ts` (orquesta reuse + queries nuevas)
- `src/controllers/superadmin/earnings.controller.ts`
- `src/routes/superadmin/earnings.routes.ts` (+ 1 línea de mount en `superadmin.routes.ts`)

## 5. Frontend (`avoqado-superadmin`)

### 5.1 Estructura (feature-based, 3 niveles máx.)

```
src/features/earnings/
  EarningsPage.tsx        # página + layout
  api.ts                  # wrappers /superadmin/earnings/* (vía `api` client)
  use-earnings.ts         # hooks TanStack Query (summary, time-series)
  types.ts                # contratos del response
  EarningsKpis.tsx        # fila de KPIs
  EarningsTrend.tsx       # recharts re-estilizado
  EarningsBreakdown.tsx   # tabs + DataTables
  earnings.mock.ts        # // TODO(api): durante scaffolding
```

- Ruta `lazy()` en `src/app/router.tsx` dentro del `<Suspense>` existente.
- Entrada de sidebar en grupo **Operación** de `AppLayout.tsx`: `{ to: '/earnings', label: 'Ganancias', icon: Wallet }`.

### 5.2 Layout (mobile-first, dark, design system)

```
┌─ Ganancias ───────────────────────[ Este mes ▾ ]──[ Exportar ]─┐
│  Ganancia total   Volumen     Margen prom.   Transacciones      │
│  $128,450.20      $4.2M       3.06%          18,204             │
│  ↳ Terminales $119.8k · En línea $8.6k                          │
│  ┌─ Tendencia ───────────────[ Día · Semana · Mes ]──────────┐  │
│  │  (área/línea recharts: terminal + online)                 │  │
│  └────────────────────────────────────────────────────────────┘ │
│  [ Negocio ][ Merchant ][ Proveedor ][ Tarjeta ][ Canal online ] │
│  ┌─ DataTable (sortable, búsqueda, export, paginación) ───────┐  │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Primitives obligatorios (no reinventar):**

- `DateRangePicker` (con `presets`: Hoy, Últimos 7 días, Este mes, Mes pasado, Este año, Personalizado).
- `DataTable` para cada desglose (búsqueda, sort, paginación, export CSV con dialog).
- `Badge` para tipos/proveedores (tono `muted` — son clasificaciones, no juicios).
- KPIs: **sin** template hero-metric AI-slop; tipografía/peso, `tabular-nums`, montos a la derecha.
- Tendencia: recharts re-estilizado a GitHub Dark (sin gradientes morado-azul, sin glow). Es información esencial, no garnish.
- Empty states que enseñan: _"No hubo transacciones en este rango. Prueba ampliar las fechas."_
- Errores: `inspectApiError` + `<QueryError>` (queries) / `toast.error` (acciones). **Prohibido** `<div>No pudimos…</div>`.

### 5.3 Helper nuevo a promover

No existe formateador de dinero. Crear `src/shared/lib/money.ts` → `formatMoney(n, { currency='MXN' })` con `Intl.NumberFormat('es-MX')`, `tabular-nums` en el render. Reusable cross-feature (regla "reuse-or-promote"). Tests unit co-localizados.

### 5.4 Fechas

Display vía `src/shared/lib/datetime.ts` (TZ default `America/Mexico_City`). El header de tablas con fecha indica TZ. El `DateRangePicker` retorna UTC ISO; se mandan como `startDate`/`endDate` query params.

## 6. Reuse de drill-down

Click en fila de **Negocio** → detalle del venue. Reusar `GET /superadmin/payment-analytics/venue/:venueId` (ya en el namespace correcto, sin modificar) o, si queremos desacoplar del todo, exponer `GET /superadmin/earnings/venue/:venueId`. **Decisión v1:** reusar el de analytics tal cual (read-only, mismo namespace, sin cambios) — cumple la regla.

## 7. Honestidad del número (etiquetado)

`TransactionCost.grossProfit = venueCharge − providerCost` = el **spread completo**. Cuando hay un **agregador** de por medio que se queda una tajada, ese número es la ganancia **bruta**, no el neto que se queda Avoqado — y el split histórico por transacción **no está persistido**. Por eso:

- La métrica se etiqueta **"Ganancia bruta"** con tooltip: _"Lo que se cobra al negocio menos lo que paga el proveedor. Si hay un agregador de por medio, su comisión aún no se descuenta aquí."_
- Afinar al neto post-agregador = mejora futura (requeriría snapshot del revenue-share por transacción).

## 8. Realtime (opcional, fuera de v1)

Patrón del repo: backend emite `{ type, id }` → `use-realtime-invalidation.ts` invalida `['superadmin','earnings',...]`. Para v1 la página es bajo tráfico y un refetch manual/by-range basta. Si se agrega: mapear un evento `superadmin:payment:recorded` en `EVENT_INVALIDATIONS`.

## 9. Testing

- **Unit:** `money.ts` (formato, redondeo, centavos→MXN). `earnings.service` merge logic si se extrae helper puro.
- **Component (RTL):** `EarningsKpis`, `EarningsBreakdown` (render de tablas, empty state), `EarningsTrend` (TZ pineado).
- **Integration (MSW):** `EarningsPage` con `/superadmin/earnings/summary` + `time-series` mockeados; estados loading/error/empty; cambio de rango re-fetcha.
- **Backend:** verificación en DB local con `psql` tras probar el flujo (sumas de `grossProfit` y `applicationFeeCents` por rango vs lo que muestra la UI). Coverage ≥ thresholds.

## 10. README + CHANGELOG

- README: nueva página top-level "Ganancias" + endpoints `/superadmin/earnings/*`.
- CHANGELOG `[Unreleased] · Added`: "Página Ganancias (terminal + online) con desglose por negocio/merchant/proveedor/tarjeta/canal y tendencia."

## 11. Riesgos / supuestos

- **Volumen de datos:** los desgloses sin `LIMIT` podrían crecer; mitigado con agregación SQL (`groupBy`/raw) + paginación en cliente vía `DataTable`. No se cargan filas crudas salvo en `export`.
- **Doble-conteo:** un `Payment` originado por checkout online tiene `ecommerceMerchantId` **y** podría tener `TransactionCost`? — verificar en implementación que online (CheckoutSession) y terminal (TransactionCost) **no se solapen** (un pago es de un bucket o del otro). Query guard: online = CheckoutSession COMPLETED; terminal = TransactionCost. Confirmar con `psql` que no hay `Payment` con ambos.
- **Margen online:** el "margen %" promedio es sólo terminal (online es fee fijo bps); la UI lo aclara para no confundir.
- **Supuesto:** "merchant" = `MerchantAccount` (cuenta de procesamiento), no el venue/cliente.
