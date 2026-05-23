# Changelog

Todos los cambios notables de este proyecto se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) y respeta
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Regla**: cada PR que cambie algo observable (UI, scripts, deps, env, flujos)
debe actualizar la sección `[Unreleased]` aquí en el mismo commit. Sin excepción.

## [Unreleased]

### Fixed

- **Bug crítico en `/api/v1/superadmin/dashboard/summary`** (server): el conteo de pagos fallidos usaba `PaymentStatus` (PENDING, PARTIAL) cuando `Payment.status` en realidad está tipado contra `TransactionStatus` (COMPLETED, FAILED, PENDING, PROCESSING, REFUNDED). Prisma rechazaba con `Invalid value for argument 'in'`. Cambiado a `TransactionStatus.FAILED`.

### Added

- **Traducciones al español de actions y entities del activity log.** Las acciones que el backend almacena en SCREAMING_SNAKE_CASE (`INVENTORY_DEDUCTED_FOR_SALE`, `RESERVATION_CREATED`, `VENUE_UPDATED`, `PAYMENT_LINK_CREATED`, etc.) ahora se renderizan en español ("Inventario descontado por venta", "Reservación creada", etc.) vía el mapa `ACTION_LABELS` en `src/features/activity-log/types.ts`. Entities (`Venue`, `Terminal`, `Staff`, `Order`, `PaymentLink`, `permission`, etc.) usan `ENTITY_LABELS` con el mismo patrón. Cualquier valor sin mapeo cae al fallback humanize (capitalize). El reglamento es: cuando aparezca un action nuevo en el backend, agrégalo aquí.

### Changed

- **Dark theme con tinte azul-pizarra.** Los neutrales pasaron de hue 130° (verde olivo) a **245° (slate-blue)**. Chroma sube ligeramente (0.018-0.024) para que el azul se note sin caer en "cyan-on-dark" (que está en la blacklist de impeccable). El accent se queda en olivo (130°) — la combinación azul-pizarra + accent olivo es complementaria, le da identidad visual al dashboard sin perder la firma de marca.

### Changed

- **Typography swap (otra vez): IBM Plex Sans → Geist** (de Vercel). IBM Plex
  se sentía áspera en dark theme; Geist es el equivalente open-source de Söhne
  (la que usa Stripe) — específicamente diseñada para consolas dev/dashboards,
  con hinting impecable y aperturas más abiertas.
- **Body weight 400 → 450** (Geist es variable; 450 da "afirmación" sobre dark
  sin perder personalidad). Esta combo es lo que usan Vercel, Linear, y los
  clones premium de Stripe.

### Added

- **Dashboard y Activity Log conectados al backend real.** Adiós a los mocks.
  - `src/features/activity-log/{types,api,use-activity-log}.ts`: consume
    `GET /api/v1/superadmin/activity-log` con TanStack Query. Mapping del
    shape del server (`SuperadminActivityLogEntry` con `staff`, `venue`,
    `entity`, `entityId`, `data`, `ipAddress`) a la UI. Categoría + severidad
    se derivan client-side desde `action` + `entity` (helpers en `types.ts`).
  - `src/features/dashboard/{types,api,use-dashboard-summary}.ts`: consume
    `GET /api/v1/superadmin/dashboard/summary` (endpoint nuevo, aditivo en
    avoqado-server) con KPIs reales: venues × estado, terminals × estado,
    KYC × verification status, staff total, pagos 24h con volumen y fallidos,
    activity log 24h.
- `MOCK_ACTIVITY` y `src/features/activity-log/mock.ts` borrados.
- `DashboardPage` ahora muestra cards "Necesita atención" derivadas del estado
  real (sólo se renderizan si hay KYC pendientes, pagos fallidos o TPVs por
  activar — empty state correcto cuando todo está OK).
- Loading/error states en ambas páginas (skeleton de KPIs + alert si el server
  no responde).

## [Unreleased-previous-batches]

### Changed

- **Typography swap: IBM Plex Sans para todo.** Reemplazadas Bricolage Grotesque
  (display) y Plus Jakarta Sans (body) por **IBM Plex Sans Variable** (display +
  body) y **IBM Plex Mono** (IDs/códigos). Diseñada por IBM para UIs técnicas y
  data-heavy — mucho más legible que la combo anterior, sobre todo en tamaños
  chicos y dark theme. Una sola familia = coherencia + carga ligeramente menor.
- **Body 13px → 14px** (line-height 1.55) — el tamaño anterior estaba bajo el
  mínimo que recomienda impeccable:typeset. La "dificultad de leer" reportada
  era principalmente size, no la fuente.

- **Feature-based file tree.** Migrado de tipo-basado (`components/`, `pages/`, `hooks/`, `lib/`, `context/`, `services/`) a feature-based con tres capas:
  - `src/app/` — wiring (main, App, router, ProtectedRoute, NotFoundPage, index.css).
  - `src/features/` — módulos de dominio self-contained (`auth/`, `dashboard/`, `activity-log/`, `realtime/`).
  - `src/shared/` — reusables cross-feature (`ui/`, `components/`, `data-table/`, `layouts/`, `lib/`).
    Forzadas tres reglas en CLAUDE.md: Three-Level Rule, unidirectional flow (`shared/ ← features/ ← app/`), alias `@/` siempre.
- **HMR-safe context/provider split**: `AuthContext.tsx` separado en `use-auth.ts` (context + hook) + `AuthProvider.tsx` (componente). Igual para CommandPalette. `DefaultErrorFallback` extraído a `ErrorFallback.tsx`. Cierra el bug `useAuth must be used inside <AuthProvider>` después de un hot reload.

### Fixed

- 7 warnings de lint resueltos:
  - 4 Fast Refresh warnings cerrados con el context split.
  - 2 `no-console` (socket.ts debug logs) — eliminados, sólo se queda el `console.warn` de connect_error.
  - 1 `test/render.tsx` re-export → eslint-disable comentado con la razón (es archivo de test, no entra al bundle).
- Lint sale 100% limpio: **0 errors, 0 warnings**.

### Added

- Regla en CLAUDE.md: **Pre-deploy verification obligatoria.** Tras terminar una tarea, correr `npm run check && npm run build` antes de declararla finalizada. Política "green or not done".
- Sección en CLAUDE.md: **Por qué NO duplicamos el login en el backend** — el endpoint `/api/v1/dashboard/auth/*` está endurecido, el desastre del web-dashboard está en su frontend.

## [Unreleased-previous-batch]

### Added

- `DataTable` reutilizable basado en TanStack Table con sorting asc/desc por
  columna, búsqueda global, paginación y export CSV con dialog para escoger
  columnas y rango de fechas.
- `Dialog` primitive (Radix) y `Checkbox` primitive reusables en
  `src/components/ui/`.
- Helper `src/lib/csv.ts` para serializar y descargar CSV con BOM UTF-8.
- Mobile drawer en `AppLayout` con hamburger en top bar para viewports < md.
- `CHANGELOG.md` (este archivo) y regla en CLAUDE.md que obliga a
  mantenerlo en sincronía.

### Changed

- `hasSuperadminRole()` ahora chequea `user.role` al top-level _primero_ y cae a
  `venues[].role` como defensa. El backend devuelve `highestRole` ahí.
- `LoginPage` hace fetch fresh de `/dashboard/auth/status` después del login y
  valida rol contra esa respuesta — más robusto que confiar en el shape del
  login response.
- `ActivityLogPage` ahora usa `DataTable`: columnas ordenables, búsqueda
  global, export CSV con dialog.
- Filter pills con `min-h-9` (≥ 36 px) — touch targets mobile-friendly.

### Fixed

- `superadmin@superadmin.com` y otros staff con rol SUPERADMIN ahora pueden
  entrar — el chequeo per-venue fallaba para usuarios cuyo rol vive sólo al
  top-level del payload.

## [0.1.0] — 2026-05-23

### Added

- Scaffold inicial: Vite 7 + React 18 + TypeScript 5 + Tailwind v4.
- Design system "Editorial Operations Terminal" con paleta OKLCH, tres fuentes
  variables (Bricolage Grotesque · Plus Jakarta Sans · JetBrains Mono) y
  utilidades custom (`eyebrow`, `display`, `tabular`).
- Dark theme por default; `.light` queda como opt-in para un toggle futuro.
- Auth interno con cookies HTTP-only contra `/api/v1/dashboard/auth/*`
  (sin Firebase).
- ProtectedRoute con gate SUPERADMIN; muestra "acceso denegado" con botón de
  logout cuando el rol no aplica.
- AppLayout con sidebar agrupado, command palette ⌘K, reloj live y status.
- DashboardPage rediseñada con KPI tiles y feed de actividad reciente.
- ActivityLogPage con tabla densa, filter pills y datos mock realistas.
- Helper `src/lib/datetime.ts` (luxon) — UTC → display en TZ del venue o
  America/Mexico_City por default.
- Realtime via Socket.IO: cliente lazy + hook `useRealtimeInvalidation` que
  mapea eventos del backend a `invalidateQueries`. El cliente no recibe datos
  por socket — sólo invalida y TanStack Query refetch del REST.
- Multi-tab logout sync vía `BroadcastChannel('avoqado-superadmin-auth')`.
- ErrorBoundary raíz + code splitting por ruta (`React.lazy` + `<Suspense>`).
- Testing stack: Vitest 4 + RTL 16 + Playwright + MSW 2. 14 tests pasando.
- CI/CD: GitHub Actions (prettier-check + lint + typecheck + tests + build +
  E2E). Dependabot con groups. Husky pre-commit (`lint-staged`) y pre-push
  (`npm run check`).
- DX: Prettier 3, eslint-config-prettier, `.editorconfig`, `.nvmrc` (Node 22),
  `.vscode/{extensions,settings}.json`.
- `CLAUDE.md` con reglas de proyecto, `.impeccable.md` con dirección estética.
- `SECURITY.md`, `CONTRIBUTING.md`, `PULL_REQUEST_TEMPLATE.md`.
- A11y: focus rings explícitos, aria-pressed en filter pills, caption en
  tablas, role=status en loading states, sr-only labels en status dots,
  Escape cierra command palette, `prefers-reduced-motion` respetado.
- `cursor: pointer` restaurado en buttons (Tailwind v4 lo quitó del default).
