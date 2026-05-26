# Avoqado · Superadmin

Consola interna de operaciones para el equipo Avoqado. Apunta al backend principal (`avoqado-server`) bajo el namespace `/api/v1/superadmin/*`. Auth interno con cookies HTTP-only — **sin Firebase**.

## Stack

| Capa              | Librería                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| **Build / UI**    | Vite 7 + React 18 + TypeScript 5                                                                       |
| **Estilos**       | Tailwind v4 + tokens OKLCH + tres fuentes variables (Inter contenido · Geist shell · Geist Mono datos) |
| **UI primitives** | shadcn-compatible (Radix) + handcrafted (`src/shared/ui/`)                                             |
| **Routing**       | React Router v6 con `lazy()` + `<Suspense>` por ruta                                                   |
| **Server state**  | TanStack Query 5 + devtools                                                                            |
| **Tablas**        | TanStack Table 8                                                                                       |
| **Forms**         | react-hook-form + zod + @hookform/resolvers                                                            |
| **HTTP**          | axios (cookies HTTP-only, no headers de bearer)                                                        |
| **Fechas / TZ**   | luxon, helper único en `src/shared/lib/datetime.ts`                                                    |
| **Charts**        | recharts                                                                                               |
| **Toasts**        | sonner                                                                                                 |
| **Iconos**        | lucide-react                                                                                           |
| **Realtime**      | socket.io-client (lazy-cableado cuando se necesite)                                                    |

## Testing

| Capa                   | Librería                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| **Unit + Integration** | Vitest 4 + React Testing Library 16 + @testing-library/user-event |
| **API mocking**        | MSW 2 (handlers en `src/test/mocks/handlers.ts`)                  |
| **E2E**                | Playwright (real Chromium, contra el dev server)                  |
| **A11y assertions**    | axe-core (planeado para wrappers de RTL)                          |
| **Coverage**           | v8 (60 % lines/functions/statements, 55 % branches)               |

## Theming

- **Dark por default.** La paleta OKLCH del `:root` es dark; la light queda en `.light` como opt-in para un toggle futuro (no expuesto en UI hoy).
- Sin "mode flicker" en primer paint — `color-scheme: dark` declarado en `:root`.
- `prefers-reduced-motion: reduce` desactiva animaciones globalmente.

## Realtime

`avoqado-server` ya expone Socket.IO. El cliente lo aprovecha vía [`src/features/realtime/use-realtime-invalidation.ts`](src/features/realtime/use-realtime-invalidation.ts):

- Conecta sólo cuando hay sesión superadmin activa (autenticación por cookie, mismo flujo que REST).
- Cada evento del backend se mapea a query keys de TanStack Query → `invalidateQueries`.
- El cliente NO recibe datos por socket; sólo invalida cache. TanStack Query refetch del endpoint REST y la UI se actualiza.
- Desconecta automáticamente en logout.

## DX y guardrails

- **ESLint 9** flat config + **typescript-eslint** + plugin react-hooks/react-refresh + eslint-config-prettier.
- **Prettier 3** integrado vía ESLint y forzado en `lint-staged`.
- **Husky 9** hooks:
  - `pre-commit` → `lint-staged` (Prettier + ESLint sobre staged).
  - `pre-push` → `typecheck + lint + tests`. El push se cancela si falla.
- **.editorconfig** + **.nvmrc** (Node 22) + **.vscode/{extensions,settings}.json**.
- **GitHub Actions CI** en cada push/PR: prettier-check + lint + typecheck + tests con coverage + build + Playwright E2E.
- **Code splitting por ruta**: bundle inicial ~141 KB gzip, cada página carga su chunk on-demand.
- **`<ErrorBoundary>` raíz** captura crashes y muestra fallback con stack — listo para integrar Sentry.

## Setup

```bash
cp .env.example .env
# Pon VITE_API_URL=http://localhost:3000/api/v1 (apunta a tu avoqado-server local)

nvm use         # Node 22 (vía .nvmrc)
npm install
npm run dev     # http://localhost:5177 (configurado en `vite.config.ts`)
```

## Scripts

| Comando                           | Qué hace                                                          |
| --------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server con HMR                                           |
| `npm run build`                   | `tsc -b && vite build` — build productivo                         |
| `npm run preview`                 | Sirve el build de producción localmente                           |
| `npm run typecheck`               | `tsc -b --noEmit`                                                 |
| `npm run lint` / `lint:fix`       | ESLint sobre todo el repo                                         |
| `npm run format` / `format:check` | Prettier (auto-fix / verify)                                      |
| `npm test`                        | Vitest en modo watch                                              |
| `npm run test:run`                | Vitest one-shot                                                   |
| `npm run test:ui`                 | Vitest UI dashboard                                               |
| `npm run test:coverage`           | Vitest + reporte de coverage (HTML + json-summary)                |
| `npm run test:e2e`                | Playwright E2E (auto-arranca el dev server)                       |
| `npm run test:e2e:install`        | Instala los binarios de browsers de Playwright (primera vez / CI) |
| `npm run test:e2e:ui`             | Playwright UI mode                                                |
| `npm run check`                   | lint + typecheck + tests (lo que corre el pre-push)               |

## Antes de pushear

Husky corre `npm run check` automáticamente. Si quieres simularlo a mano:

```bash
npm run check
```

Si el cambio es de UI, además:

```bash
# Invoca la skill — el CLAUDE.md exige audit obligatorio tras cambios visibles.
# Ver .impeccable.md para la dirección estética y los anti-patrones prohibidos.
```

## Backend

Este dashboard consume `avoqado-server` bajo el namespace **existente** `/api/v1/superadmin/*`, ya protegido por `authenticateTokenMiddleware` + `authorizeRole([StaffRole.SUPERADMIN])`. **No** existe un servicio separado y **no** se crea un namespace `v2` paralelo.

Auth interno: cookies HTTP-only emitidas por `POST /api/v1/dashboard/auth/login`. axios con `withCredentials: true`. La UI nunca toca tokens.

### Política de evolución (cómo NO romper al `avoqado-web-dashboard` que también consume estos endpoints)

1. **Aditivo siempre.** Cambios permitidos:
   - Agregar campos opcionales a un response.
   - Agregar endpoints nuevos.
   - Agregar query params opcionales.

   Cambios **prohibidos** (rompen al dashboard viejo):
   - Quitar o renombrar campos.
   - Cambiar tipos de campos existentes.
   - Cambiar la semántica de un campo.

2. **Sub-versión por endpoint cuando el shape genuinamente cambia.** Sólo ese endpoint adquiere un sufijo `/v2` (ej. `GET /superadmin/venues/v2`). El viejo sigue funcionando hasta que el dashboard viejo migre.

3. **Contract tests opcionales** en `avoqado-server` para pinear el shape vía snapshot — falla CI si alguien rompe sin querer.

## Timezone

- **Backend transmite UTC** (ISO 8601 con sufijo `Z`).
- **Display default**: `America/Mexico_City`.
- **Cuando la respuesta incluye `venue.timezone`**: se pasa explícitamente al helper para mostrar en hora del venue.
- Todas las funciones de fecha viven en [`src/shared/lib/datetime.ts`](src/shared/lib/datetime.ts):
  - `formatDateTime(iso, tz?)`, `formatDate`, `formatTime`, `formatDateISO`, `formatRelative`, `timezoneShort`.
- En headers de tabla siempre se indica el TZ visible (`Creado ({timezoneShort(tz)})`).

Nada se infiere del browser. La decisión es explícita en cada uso.

## Páginas

Toda ruta es `lazy()` + `<Suspense>` (code-splitting por ruta) y vive en [`src/app/router.tsx`](src/app/router.tsx). Salvo `/login`, todas pasan por `ProtectedRoute` (gate SUPERADMIN).

| Ruta                                                        | Página                                                                              | Feature        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------- |
| `/login`                                                    | Login (email + password / Google)                                                   | `auth`         |
| `/dashboard`                                                | Resumen operativo                                                                   | `dashboard`    |
| `/activity-log`                                             | Bitácora de acciones (ActivityLog)                                                  | `activity-log` |
| `/system-logs`                                              | Stream de logs de Render                                                            | `system-logs`  |
| `/venues` · `/venues/new` · `/venues/:id`                   | Listado, alta y detalle de venues                                                   | `venues`       |
| `/venues/:id/{owner,kyc,pricing,terminals/new}`             | Sub-páginas de un venue                                                             | `venues`       |
| `/venues/:id/merchant`                                      | Asignación de merchants a slots (primary/secondary/tertiary) + procesador preferido | `venues`       |
| `/terminals` · `/terminals/new` · `/terminals/:id/settings` | TPVs: listado, alta, ajustes                                                        | `terminals`    |
| `/merchants` · `/merchants/:id`                             | Registro de merchant accounts + detalle (economía, liquidación, readiness)          | `merchants`    |
| `/merchants/new`                                            | Alta guiada **Blumon** (panel de cards → un POST a `blumon/full-setup`)             | `merchants`    |
| `/merchants/new-angelpay`                                   | Alta guiada **AngelPay** (panel de cards → un POST a `full-setup-angelpay`)         | `merchants`    |

## Estructura

Feature-based: `shared/` ← `features/` ← `app/` (flujo unidireccional; `shared/` nunca importa de `features/`). Máximo 3 niveles bajo `src/`.

```
src/
├── app/                # Wiring de la app (sólo al boot)
│                       #   main.tsx · App.tsx · router.tsx (rutas lazy) · ProtectedRoute · index.css
├── features/           # Módulos de dominio, self-contained (api + hooks + páginas colocados)
│   ├── auth/           # api + use-auth + AuthProvider + LoginPage
│   ├── dashboard/      # /dashboard
│   ├── activity-log/   # /activity-log
│   ├── system-logs/    # /system-logs (stream de Render)
│   ├── venues/         # /venues (+ alta, detalle, owner, kyc, pricing, config de pagos)
│   ├── terminals/      # /terminals (+ alta, settings) — TPVs
│   ├── merchants/      # /merchants (registro + economía + liquidación + alta guiada Blumon/AngelPay)
│   └── realtime/       # socket.io + use-realtime-invalidation
├── shared/             # Reusables cross-feature
│   ├── ui/             # Button, IconButton, Badge, Combobox, Drawer, Dialog… (primitives)
│   ├── components/     # Brandmark, CommandPalette, ErrorBoundary, QueryError, RouteLoader…
│   ├── data-table/     # DataTable + ExportDialog
│   ├── filters/        # FilterPill + MultiSelectFilterContent
│   ├── layouts/        # AppLayout (sidebar + MobileTopBar)
│   └── lib/            # api (axios), datetime (luxon), csv, api-error, utils (cn)
├── test/               # setup.ts, mocks/handlers.ts, render.tsx
└── types/              # tipos compartidos
e2e/                    # Playwright specs
.github/workflows/      # CI
.husky/                 # pre-commit + pre-push
```

## Agregar componentes shadcn/ui

```bash
npx shadcn@latest add button input label card dialog dropdown-menu
```

**Después de instalar**: re-estiliza al design system (`.impeccable.md`) — los defaults de shadcn son reconociblemente AI-genéricos.

## Releases

Pendiente: pipeline de release (semver + changelog automático). Por ahora, los commits a `main` viajan a Cloudflare Pages (o equivalente) manualmente.
