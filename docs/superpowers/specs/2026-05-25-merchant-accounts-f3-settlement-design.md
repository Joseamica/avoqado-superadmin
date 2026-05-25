# Merchant Accounts — Fase 3: Liquidación editable + proyección · Diseño

> Estado: **propuesta para revisión**. Feature: consola superadmin (`avoqado-superadmin`).
> Fecha: 2026-05-25. Depende de F1 + F2. Reglas: branch `develop`, sin worktree/branch, **sin commit**, sin `npm run format` global.

## 1. Objetivo

Volver editable la **liquidación** (días D+N por tarjeta) que F1 ya lee, y mostrar un **estimado de fecha de depósito** ("una venta hoy se deposita el …") que excluye fines de semana y **feriados** (de `date.nager.at`, cacheados en `HolidayCalendar` vía un endpoint nuevo del server).

## 2. Alcance

**Dentro de F3**

- Editar **`SettlementConfiguration`** por `(merchant, cardType)`: `settlementDays`, `settlementDayType` (hábiles/naturales), `cutoffTime`, `cutoffTimezone`.
- **Proyección de fecha de depósito** client-side (pura, testeable) usando los feriados del endpoint.
- **Server (aditivo, deploy-first):** endpoint `GET /superadmin/holidays?year&country` que proxea `date.nager.at` y **upserta** en `HolidayCalendar`; `logAction` en create/update de settlement.

**Fuera de F3**

- Refinar feriados civiles → inhábiles bancarios autoritativos (Banxico/CNBV) — Nager es un estimado aceptable para preview.
- Incidencias de liquidación / `ProcessorReliabilityMetric` (dashboard SOFOM) — fase posterior.
- F4 (slots/routing), F5 (wizards). Versionado de configs (se edita **en sitio**).

## 3. Decisiones de diseño

1. **Editar en sitio** (igual que F2): por tarjeta, `PUT /settlement-configurations/:id` si existe la config activa, `POST` con `effectiveFrom = ahora` si no.
2. **Proyección client-side**: `settlement.ts` (función pura) calcula la fecha; los feriados llegan del endpoint del server (no fetch directo a Nager desde el cliente → respeta "cliente sólo habla con avoqado-server").
3. **Caveat documentado en UI**: Nager da feriados civiles (≈ inhábiles bancarios); el preview es un **estimado**, no la fecha real de liquidación.
4. **Cutoff compartido** en el drawer (un `cutoffTime` + `cutoffTimezone` para todas las tarjetas; el backend lo guarda por config). Por-tarjeta sólo varían `settlementDays` + `settlementDayType` (típico: déb/créd D+1, amex/intl D+3).

## 4. Contratos de datos

| Acción                           | Método · ruta · body                                                                                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settlement (load all)            | `GET /superadmin/settlement-configurations?merchantAccountId=` _(F1 ya tiene `fetchSettlements`)_                                                                                                                                                   |
| Guardar settlement (por tarjeta) | `PUT /superadmin/settlement-configurations/:id` o `POST /superadmin/settlement-configurations` body `{ merchantAccountId, cardType, settlementDays, settlementDayType, cutoffTime, cutoffTimezone, effectiveFrom }` _(verificado en el controller)_ |
| **Feriados (NUEVO, server)**     | `GET /superadmin/holidays?year=2026&country=MX` → `{ success, data: [{ date: 'YYYY-MM-DD', name: string }] }`                                                                                                                                       |

### Endpoint nuevo del server (avoqado-server)

- Ruta: `GET /api/v1/superadmin/holidays?year=&country=` (default `country=MX`). Montar en `superadmin.routes.ts`.
- Controller: si `HolidayCalendar` ya tiene filas para `year` → devolverlas. Si no → `fetch('https://date.nager.at/api/v3/PublicHolidays/{year}/{country}')` (usar el cliente HTTP que ya use el server — **confirmar al implementar**: axios/fetch), **upsert** cada feriado en `HolidayCalendar` (`{ name, date, year, holidayType: 'BANKING', isBanking: true }`, idempotente por el unique `[date, holidayType]`), y devolver `[{date, name}]`. Errores de Nager → 502 con mensaje claro (el cliente cae a "sin feriados" — ver §6).
- **`logAction`** opcional aquí (lectura/cache); **sí** en settlement create/update.

## 5. Arquitectura frontend

```
src/features/merchants/
├── settlement.ts              # projectSettlementDate(from, days, dayType, holidays) — puro
├── settlement.test.ts
├── EditSettlementDrawer.tsx   # filas por tarjeta + cutoff + preview de depósito
└── EditSettlementDrawer.test.tsx
```

- **api.ts** (append): `fetchHolidays(year, country?) → Set<string>` (ISO dates); `saveSettlement(merchantAccountId, rows, existingByCard) → Promise<void>` (por tarjeta PUT/POST). Reusa `fetchSettlements` (F1).
- **use-merchants.ts** (append): `useHolidays(year)` (staleTime largo, p.ej. 24h); `useSaveSettlement` (invalida `MERCHANTS_QUERY_KEY`).
- **MerchantDetailPage.tsx**: botón "Editar liquidación" en la sección _Liquidación_ (abre `EditSettlementDrawer`).

## 6. Algoritmo de proyección (`settlement.ts`)

```
projectSettlementDate(from: Date, days: number, dayType: SettlementDayType, holidays: Set<string>): Date
```

- `toISODate(d)` → 'YYYY-MM-DD' (en `America/Mexico_City`, vía datetime.ts).
- `CALENDAR_DAYS`: avanza `days` días naturales desde `from`.
- `BUSINESS_DAYS`: avanza día a día; cuenta el día sólo si **no** es sábado/domingo **y** `!holidays.has(toISODate(día))`; se detiene al contar `days`.
- `days = 0` → `from` (mismo día). Si `holidays` está vacío (endpoint falló) → degrada a sólo-fines-de-semana, con nota visible.
- Puro y testeable (no fetch). El drawer le pasa `from = hoy` (vía datetime.ts) y el `Set` de feriados de `useHolidays`.

## 7. EditSettlementDrawer (UI)

- Una fila por `CardType`: input `settlementDays` (entero ≥ 0) + `Combobox` `settlementDayType` (Hábiles/Naturales) + columna "Venta hoy → deposita {fecha}" (usa `projectSettlementDate` + feriados + `formatDateTime`).
- `cutoffTime` (input `HH:MM`) + `cutoffTimezone` (`Combobox`, default `America/Mexico_City`) compartidos.
- Carga inicial: `fetchSettlements` (F1) da las configs activas → hidrata las filas; tarjetas sin config arrancan con default (déb/créd D+1, amex/intl D+3, hábiles).
- Guardar: por tarjeta, PUT si tenía config (id conocido), POST si no. `toast` + `inspectApiError`. Invalida y refresca el detalle.
- Reusa `Drawer*`, `Button`, `Combobox`; inputs estilo F2; nota del caveat de feriados.

## 8. Testing

- **Unit `settlement.ts`:** D+1 hábil salta sábado→lunes; D+3 con feriado intermedio; CALENDAR_DAYS; `days=0`; sin feriados.
- **Integración `EditSettlementDrawer`:** mock `fetchSettlements` (1 config débito) + `holidays` + `PUT settlement/:id` capturando body → editar débito a `2` días → assert `settlementDays: 2` en el PUT + toast.
- **Server:** (si se prueba) holidays endpoint mockeando Nager → upsert + shape `{date,name}`.
- Mantener verdes F1+F2.

## 9. Riesgos / abiertos

- Cliente HTTP del server para llamar Nager (axios vs fetch nativo) — confirmar al implementar el controller.
- TZ en la proyección: operar por fecha-only en `America/Mexico_City` evita corrimientos; el cutoff time-of-day NO se modela en el preview (es estimado) — documentado en la nota.
- Nager rate limits: bajo, y cacheamos en `HolidayCalendar` tras la 1ª llamada del año.

## 10. Decomposición (para el plan)

- **F3·A:** server holidays endpoint (+ mount) · `settlement.ts` + tests · api/hooks (`fetchHolidays`/`saveSettlement`/`useHolidays`/`useSaveSettlement`).
- **F3·B:** `EditSettlementDrawer` + wire en _Liquidación_ · `logAction` settlement server-side · docs + gate.
