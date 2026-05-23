# avoqado-superadmin — Project Instructions

This file overrides default behavior for any AI assistant working on this repository. Read [CLAUDE.md del workspace](../CLAUDE.md) for ecosystem-wide rules; this file adds project-specific rules on top.

---

## Backend it talks to

This app is the **superadmin frontend** for the Avoqado platform. It calls **`avoqado-server`** at the existing namespace **`/api/v1/superadmin/*`** (already protected by `authenticateTokenMiddleware` + `authorizeRole([StaffRole.SUPERADMIN])`). There is **no** separate server, **no** parallel database, **no** namespace `v2` by default.

### Auth — cookies HTTP-only, no Firebase

Auth uses the **internal session cookies** issued by `avoqado-server` at `/api/v1/dashboard/auth/*`:

- `POST /dashboard/auth/login` (email + password)
- `POST /dashboard/auth/logout`
- `GET /dashboard/auth/status`
- `GET /dashboard/auth/google/url` + `POST /dashboard/auth/google/callback`

axios is configured with `withCredentials: true` — **never** add an `Authorization: Bearer` header. **Never** import `firebase/auth`. The optimistic UX hint is a localStorage flag `avoqado_session_hint` that lets us skip the loading flash on reload; it is not a security boundary.

The SUPERADMIN gate happens in [src/app/ProtectedRoute.tsx](src/app/ProtectedRoute.tsx): authenticated users without a SUPERADMIN role on any venue see "acceso denegado" instead of the dashboard.

**Login flow rule**: `login()` returns the `LoginResponse` (con `staff`). El caller **debe verificar `hasSuperadminRole(response.staff)` antes de navegar a `/dashboard`**. Si el user no es superadmin, hay que llamar `logout()` para limpiar el cookie y mostrar el error in-place — no dejarlo entrar al ProtectedRoute, eso causaría un flash de "acceso denegado" después del navigate. Ver [src/features/auth/LoginPage.tsx](src/features/auth/LoginPage.tsx) como referencia.

**Multi-tab sync**: el AuthContext usa `BroadcastChannel('avoqado-superadmin-auth')` para sincronizar login/logout entre tabs. Si cierras sesión en un tab, los otros tabs se cierran solos.

### Realtime — Socket.IO con invalidación de queries

`avoqado-server` ya tiene Socket.IO montado. Aprovechamos para refrescar la consola en tiempo real **sin que el cliente reciba datos por socket**:

1. El backend emite eventos chiquitos (`{ type, id }`) cuando algo cambia (KYC nuevo, payment fail, terminal disconnect, etc.).
2. El cliente escucha vía [`src/features/realtime/use-realtime-invalidation.ts`](src/features/realtime/use-realtime-invalidation.ts).
3. El handler **no muta cache directamente**. Sólo llama `queryClient.invalidateQueries(['superadmin', ...])`.
4. TanStack Query refetch del endpoint REST → cache actualizada → UI re-renderea.

Ventajas: un único path de datos (REST → cache), permisos siguen en la capa REST, dedup automática, escala sin que cada cliente reciba payloads grandes por socket.

Cuando agregues una página/feature nueva al superadmin:

1. Define el evento del backend (ej. `superadmin:venue:updated`).
2. Mapéalo en `EVENT_INVALIDATIONS` con las query keys afectadas.
3. El hook se encarga del resto.

El socket sólo conecta cuando hay sesión superadmin activa y se desconecta automáticamente en logout (handled by `AuthContext` + `disconnectSocket`).

### API evolution policy — **CRÍTICO, NO ROMPER NADA**

`avoqado-web-dashboard` (el dashboard superadmin **legacy** que sigue en producción) consume los mismos endpoints de `/api/v1/superadmin/*`. Cualquier cambio que rompa esos endpoints **rompe operaciones en vivo**.

1. **Aditivo siempre.** Permitido:
   - Agregar campos opcionales a un response.
   - Agregar endpoints nuevos.
   - Agregar query params opcionales.

   **Prohibido** (rompe al dashboard legacy):
   - Quitar o renombrar campos existentes.
   - Cambiar tipos (`string` → `number`, etc.).
   - Cambiar la semántica de un campo aunque conserve el nombre.
   - Cambiar el status code de éxito.

2. **Sub-versión por endpoint** sólo cuando el shape genuinamente debe romperse. El endpoint adquiere sufijo `/v2` (ej. `GET /superadmin/venues/v2`); el viejo sigue funcionando hasta que el dashboard legacy migre.

3. **Nunca crear un namespace paralelo** `/superadmin-v2/*`. Duplica 25 routers con cero valor.

4. **Antes de tocar un endpoint** corre `grep -rn "<endpoint>" /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard` para ver dónde lo consume el legacy.

### ActivityLog registration (write side)

Whenever you implement a write operation that mutates state of value (creates a venue, approves KYC, changes commission, lanza un update de TPV, etc.), **also** register the action in the activity log (server-side, via the existing activity-log service). This is non-negotiable: la trazabilidad operativa de Avoqado depende de eso.

---

## Design — read this before any UI work

The repo has a `.impeccable.md` at the root that defines the design system, palette, typography, and the aesthetic commitments ("Editorial Operations Terminal"). **You must read it before designing any new screen or component.**

### Design Principles

Cinco lentes que pasan sobre cada decisión visual. Si tu diseño no defiende todas, vuelve a empezar. La versión larga (target audience, use cases, anti-patterns, differentiation) vive en [.impeccable.md](.impeccable.md).

1. **Operative speed beats first impression.** Power user 6+ h/día. `⌘K`, density tipográfica y legibilidad tabular ganan sobre hero animations. Touch targets ≥ 36 px y drawer < md porque ops también opera desde móvil.
2. **Editorial density, never Bloomberg ugliness.** La tipografía conduce el layout — Bricolage en KPIs es nuestra firma B2B. Ritmo variado: secciones respiran, tablas compactan; "mismo padding everywhere" es flat.
3. **Warm precision, not cold tech.** OKLCH tintado verde (`130°`) + olivo con parsimonia. Sin purple-to-blue, sin cyan-on-dark, sin neón, sin glassmorphism. El undertone cálido viene del producto (payments en México), no del tooling.
4. **Numerals are data, not decoration.** `tabular-nums` siempre; montos a la derecha; status pills semánticas (tint 8 % + border 30 %). Sparklines sólo si el trend es información esencial — nunca como garnish.
5. **Empty states teach the interface.** "No hay KYC pendientes. Última revisión hace 3 h" en vez de "Nothing here". Cada vacío explica qué hace la pantalla, qué espera, y qué pasó por última vez.

### Hard rules

- **Dark theme es el default.** Las variables de `:root` son dark. La paleta light queda en la clase `.light` por si en el futuro necesitamos toggle — hoy NO está expuesta en UI. Si tu cambio asume light, lo más probable es que esté mal.
- **Mobile first / mobile friendly** — el operador usa esta consola desde móvil también:
  - Touch targets mínimos: 36 px de alto (`h-9`) para acciones secundarias, 44 px (`h-11`) para CTA principales.
  - El sidebar fijo desaparece en `< md`; usa el `MobileTopBar` + drawer del `AppLayout`.
  - Las tablas viven dentro de un `overflow-x-auto`; nunca rompen viewport.
  - Texto base ≥ 13 px; nunca uses 10 px para datos críticos.
  - Headers de tabla `eyebrow` quedan en 10.5 px sólo porque están en uppercase + tracking — son OK.
  - Forms en mobile: campos full-width, label encima del input, botón CTA full-width.
- **DataTable es el componente único para listas**: [src/shared/data-table/DataTable.tsx](src/shared/data-table/DataTable.tsx). Sortable headers, búsqueda global, paginación, export CSV con dialog (rango de fechas + selección de columnas). Cualquier nueva página de listado debe usar este componente — no escribir `<table>` a mano.
- **Todo `<button>` no-disabled tiene `cursor: pointer`** vía el base layer de `src/index.css` (Tailwind v4 lo quitó del default). No lo agregues por componente.
- **`impeccable:audit` is mandatory** after any visible UI change. Run it before pushing. If the audit surfaces severity ≥ "high" issues, fix them in the same PR.
- **`impeccable:frontend-design`** is the skill to invoke when designing a new screen or component from scratch (loads the design protocol + the AI slop test).
- **`impeccable:polish`** is the skill to run as the final pass before shipping a page to production (or before review).
- **Never invent fonts.** Only the three families declared in `.impeccable.md` (Geist Variable, Geist Variable, JetBrains Mono) — added via `@fontsource-variable/*`.
- **Never use** the AI slop patterns enumerated in `.impeccable.md`: glassmorphism, purple-to-blue gradients, cyan-on-dark, sparklines as decoration, nested cards, hero-metric template, bouncy easings.
- **Tabular numerals** on every numeric / date cell (`font-variant-numeric: tabular-nums`). Right-align monetary amounts.
- **Empty states teach** the interface (`"No hay KYC pendientes. Última revisión: hace 3h"`), not "Nothing here".

### Suggested skill order for new screens

1. Read `.impeccable.md`
2. Invoke `impeccable:frontend-design` for the design guidance
3. Build the screen
4. Invoke `impeccable:polish` for the final visual pass
5. Invoke `impeccable:audit` before commit

---

## Datetime — always use the helper

`avoqado-server` transmits all timestamps in **UTC ISO 8601** (`...Z` suffix). The UI never displays raw UTC.

- **Always import from [`src/shared/lib/datetime.ts`](src/shared/lib/datetime.ts).** Never call `new Date().toLocaleString()` or instantiate `luxon` ad-hoc.
- Default timezone is `America/Mexico_City`. If the data row includes a `venue.timezone`, pass it as the second argument: `formatDateTime(order.createdAt, order.venue.timezone)`.
- **Table headers must indicate the visible timezone**: `Creado ({timezoneShort(tz)})`.
- Tests for date-rendering components should pin the timezone explicitly (the test setup ya pinea `America/Mexico_City`).

---

## Testing — every PR must include tests

The repo runs **Vitest 4** (unit + integration), **React Testing Library**, **Playwright** (E2E in real Chromium), and **MSW** (HTTP mocking).

### Mandatory before push

`npm run check` runs typecheck + lint + tests. The Husky `pre-push` hook runs the same — el push **se cancela** si falla algo. No saltes con `--no-verify` salvo emergencia documentada.

### When to write what kind of test

| Tipo                                 | Cuándo                                                                                                  | Ubicación                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Unit** (Vitest)                    | Helpers puros (`src/shared/lib/datetime.ts`), `cn()`, validadores zod.                                  | Co-localizado: `foo.test.ts` junto a `foo.ts`. |
| **Component** (Vitest + RTL)         | UI primitive con lógica visible (`Button`, `Badge`, `Field`).                                           | Co-localizado: `Component.test.tsx`.           |
| **Integration** (Vitest + RTL + MSW) | Página + datos + auth (`LoginPage`, `DashboardPage`). MSW mockea `/dashboard/auth/*` y `/superadmin/*`. | Co-localizado o en `src/features/<feature>/`.  |
| **E2E** (Playwright)                 | Flujos completos contra el dev server real.                                                             | `e2e/*.spec.ts`.                               |

### Conventions

- Usa `renderWithProviders` de [`src/test/render.tsx`](src/test/render.tsx) — incluye `QueryClient`, `MemoryRouter`, `AuthProvider` listos para usar.
- Mocks de API van en [`src/test/mocks/handlers.ts`](src/test/mocks/handlers.ts). Por defecto las queries fallan (queries devuelven `authenticated: false`). En el test específico usa `server.use(http.post(...))` para sobrescribir.
- **Lock al TZ**: `process.env.TZ = 'America/Mexico_City'` ya está en `src/test/setup.ts`. Si necesitas un TZ distinto, hazlo dentro del test con `vi.stubEnv('TZ', '...')` y restaura en `afterEach`.
- Coverage threshold: 60 % lines / functions / statements, 55 % branches. Si el cambio baja la cobertura, **agrega tests** (no bajes el threshold).

### Verificación en base de datos (cuando aplique)

Esta app no tiene DB propia: los writes van a **`avoqado-server`** (PostgreSQL vía Prisma). Siempre que puedas — tras implementar o probar un flujo que **persiste datos** (login/sesión, KYC, venues, activity log, etc.) — **confirma en la DB local** que quedó como esperabas, además de los tests automatizados.

```bash
export DATABASE_URL="postgresql://postgres:exitosoy777@localhost:5432/av-db-25"

# Ejemplos (ajusta tablas/columnas al feature)
psql "$DATABASE_URL" -c 'SELECT id, email FROM "Staff" WHERE email = '\''ops@example.com'\'' LIMIT 5;'
psql "$DATABASE_URL" -c 'SELECT id, "actionType", "createdAt" FROM "ActivityLog" ORDER BY "createdAt" DESC LIMIT 10;'
```

Reglas:

- Usa `psql` (o una query puntual) **después** de reproducir el flujo en la UI o en E2E — no sustituye Vitest/Playwright, los complementa.
- Valida filas creadas/actualizadas, FKs, enums y timestamps (`createdAt`, `venueId`, etc.) según el caso.
- Si el test es sólo UI sin backend real (MSW), no hace falta psql; si tocaste **`avoqado-server`** o probaste contra API local, **sí**.

---

## File tree — feature-based

```
src/
├── app/                          # App-level wiring. Sólo cargado al boot.
│   ├── main.tsx                  # entry
│   ├── App.tsx
│   ├── providers.tsx (futuro)
│   ├── router.tsx
│   ├── ProtectedRoute.tsx
│   ├── NotFoundPage.tsx
│   └── index.css
├── features/                     # Módulos de dominio. Self-contained.
│   ├── auth/
│   │   ├── api.ts                # Wrappers sobre /dashboard/auth/*
│   │   ├── use-auth.ts           # Context + hook (HMR-safe, .ts)
│   │   ├── AuthProvider.tsx      # Provider component (.tsx)
│   │   └── LoginPage.tsx
│   ├── dashboard/
│   ├── activity-log/
│   └── realtime/
├── shared/                       # Reusables cross-feature.
│   ├── ui/                       # Atomic primitives (Button, Badge, …)
│   ├── components/               # Cross-feature components (Brandmark, CommandPalette, ErrorBoundary, …)
│   ├── data-table/               # DataTable + ExportDialog
│   ├── layouts/                  # AppLayout
│   └── lib/                      # api, datetime, csv, utils
└── test/                         # Vitest setup + MSW handlers + render helper
```

### Reglas de la estructura (forzadas en code review)

1. **Three-Level Rule.** Máximo 3 niveles de profundidad bajo `src/`. Si llegas a 4 (`src/features/auth/components/forms/Input.tsx`), o subes el archivo o repensaste el agrupamiento.

2. **Unidirectional flow.** `shared/` ← `features/` ← `app/`. Nunca al revés.
   - `shared/` nunca importa de `features/` ni de `app/`.
   - `features/<X>` nunca importa de `features/<Y>` directo — si dos features lo necesitan, súbelo a `shared/`.
   - `app/` puede importar de todo.

3. **HMR-safe context split.** Cuando un módulo combina un Context + un Provider component:
   - El **context object + hook** vive en `.ts` (ej. `use-auth.ts`, `use-command-palette.ts`).
   - El **provider component** vive en `.tsx` (ej. `AuthProvider.tsx`).
   - **Nunca** mezclar `createContext` + hook + componentes JSX en el mismo archivo: rompe Fast Refresh y crea el bug `useAuth must be used inside <AuthProvider>` después de un hot reload.

4. **Explicit imports.** Usa el alias `@/` siempre (`@/shared/ui/Button`), no relativos hacia arriba (`../../shared/ui/Button`). Excepción: imports en el mismo folder (`./mock`, `./ErrorFallback`) son OK.

5. **Colocation.** Tests (`*.test.ts`), mocks (`*.mock.ts`, o `mock.ts` dentro del feature) y types viven junto al código que sirven.

---

## File / code conventions

- **TypeScript strict** — no `any` salvo con comentario justificando. Prefiere `unknown` + narrow.
- **No barrel files** para componentes o páginas — mantén imports explícitos.
- **Routes** viven en `src/app/router.tsx`. Nueva page = nuevo archivo bajo `src/features/` + entry en el router. **Toda nueva ruta debe ser `lazy()` + integrarse al `<Suspense>` ya configurado.**
- **API hooks** colocados junto a la página que los consume (`src/features/venues/use-venues.ts`) salvo que los reusen ≥2 páginas — entonces a `src/shared/hooks/`.
- **Mock data**: durante scaffolding está OK. Cada archivo debe (a) vivir junto a la página, (b) llamarse `*.mock.ts`, (c) contener un `// TODO(api):` apuntando al endpoint real.
- **shadcn primitives**: cuando un primitive de Radix matche, instala vía `npx shadcn@latest add` y después **re-estiliza** al design system (nunca dejes el look default — es AI-genérico reconocible).
- **No `useEffect`** para derived state. Compútalo durante render.

---

## Forbidden patterns (instant rejection)

- Llamar `/api/v1/admin/*` (el namespace no existe — usa `/superadmin` o `/dashboard/auth`).
- Importar `firebase/*` (auth es interno; Firebase no está en deps).
- `new Date(...)` seguido de `.toLocaleString()` (usa `datetime.ts`).
- `console.log` committeado (sólo `console.warn` / `console.error` están permitidos por ESLint).
- `// eslint-disable` sin un comentario al lado explicando por qué.
- Mezclar `axios` y `fetch` — solo `api` desde `src/shared/lib/api.ts`.
- Hardcodear URLs de API — solo `VITE_API_URL` vía el `api` client.
- Saltarse el pre-push hook (`git push --no-verify`) sin razón documentada.

---

## Workflow expectations

### Verificación pre-deploy obligatoria

**Tras terminar una tarea, ANTES de decir "listo" al usuario:**

```bash
npm run check       # lint + typecheck + tests
npm run build       # build de producción
```

Si alguno falla, NO se reporta como completada. El usuario no debería tener que descubrir warnings o errores con su propio `npm run lint`. La regla es **"green or not done"**.

El pre-push hook ya corre `check`, pero esa red de seguridad llega tarde — si el build falla en CI, el ciclo de feedback es de minutos. Corrr `check + build` local antes de declarar finalizada cualquier tarea no trivial.

### Por qué NO duplicamos el login en el backend

`avoqado-server` tiene `/api/v1/dashboard/auth/*` endurecido con años de incidentes reales (CSRF, session fixation, JWT rotation, OAuth callback). El "desastre" de `avoqado-web-dashboard` está en su **frontend** (AuthContext con live demo, multi-venue, white-label, pendingInvitations, etc.). Nuestro `AuthContext` (124 líneas) ya es la versión mínima.

**Prohibido**: crear `/api/v1/superadmin/auth/*` paralelo. Duplica Staff table, JWT signing, Google OAuth, cookie config, refresh token logic — todo para reinventar lo que ya funciona. Consume los endpoints existentes.

### Workflow normal

- **Antes de pushear:** `npm run check` (lint + typecheck + tests). El `pre-push` hook lo corre automáticamente.
- **Antes de commitear:** `lint-staged` corre Prettier + ESLint sobre los archivos staged (automático vía Husky `pre-commit`).
- **Formato:** `npm run format` para auto-formatear todo el repo. CI corre `npm run format:check`.
- **Commits:** pequeños, focused, presente (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`). Co-author tag para commits asistidos por IA.

### Mantén el README en sincronía con el código

**Cualquier cambio que afecte cómo otro humano entiende, instala, corre, prueba o despliega el proyecto debe actualizar el README en el mismo commit.** Disparadores típicos:

- Agregar/quitar una dependencia visible al usuario (testing tool, framework, librería UI).
- Cambiar/agregar un script de `npm run …`.
- Cambiar el flujo de auth, las variables de entorno, los puertos por defecto.
- Agregar/quitar páginas top-level.
- Cambiar la política de release o despliegue.

Si tu PR cambia algo de lo anterior y el README sigue igual → **el PR está incompleto.**

### Mantén el CHANGELOG en sincronía

**Cada PR debe añadir una entrada en [`CHANGELOG.md`](CHANGELOG.md) bajo la sección `[Unreleased]`**, categoría correcta (`Added` / `Changed` / `Fixed` / `Removed` / `Deprecated` / `Security`). El formato sigue [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/).

Si tu PR no toca el changelog → **el PR está incompleto.** El reviewer lo va a rechazar.

Sólo se exenta de esto: cambios puramente de comentarios o renames internos sin impacto observable.

---

## Quick reference

| What                | Where                                                |
| ------------------- | ---------------------------------------------------- |
| API client (axios)  | `src/shared/lib/api.ts`                              |
| Auth service        | `src/features/auth/api.ts`                           |
| Auth context + hook | `src/features/auth/use-auth.ts`                      |
| Auth provider       | `src/features/auth/AuthProvider.tsx`                 |
| Datetime helpers    | `src/shared/lib/datetime.ts`                         |
| CSV helpers         | `src/shared/lib/csv.ts`                              |
| Class merge `cn()`  | `src/shared/lib/utils.ts`                            |
| Layout (sidebar)    | `src/shared/layouts/AppLayout.tsx`                   |
| Command Palette     | `src/shared/components/CommandPalette.tsx`           |
| Error Boundary      | `src/shared/components/ErrorBoundary.tsx`            |
| DataTable           | `src/shared/data-table/DataTable.tsx`                |
| ExportDialog        | `src/shared/data-table/ExportDialog.tsx`             |
| Routes              | `src/app/router.tsx`                                 |
| Protected route     | `src/app/ProtectedRoute.tsx`                         |
| Realtime socket     | `src/features/realtime/socket.ts`                    |
| Realtime hook       | `src/features/realtime/use-realtime-invalidation.ts` |
| Design context      | `.impeccable.md`                                     |
| Test setup          | `src/test/setup.ts` + `src/test/mocks/handlers.ts`   |
| Test render wrapper | `src/test/render.tsx`                                |
| E2E specs           | `e2e/*.spec.ts`                                      |
| CI workflow         | `.github/workflows/ci.yml`                           |
