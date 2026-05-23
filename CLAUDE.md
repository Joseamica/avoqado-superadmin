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

The SUPERADMIN gate happens in [src/router/ProtectedRoute.tsx](src/router/ProtectedRoute.tsx): authenticated users without a SUPERADMIN role on any venue see "acceso denegado" instead of the dashboard.

**Login flow rule**: `login()` returns the `LoginResponse` (con `staff`). El caller **debe verificar `hasSuperadminRole(response.staff)` antes de navegar a `/dashboard`**. Si el user no es superadmin, hay que llamar `logout()` para limpiar el cookie y mostrar el error in-place — no dejarlo entrar al ProtectedRoute, eso causaría un flash de "acceso denegado" después del navigate. Ver [src/pages/LoginPage.tsx](src/pages/LoginPage.tsx) como referencia.

**Multi-tab sync**: el AuthContext usa `BroadcastChannel('avoqado-superadmin-auth')` para sincronizar login/logout entre tabs. Si cierras sesión en un tab, los otros tabs se cierran solos.

### Realtime — Socket.IO con invalidación de queries

`avoqado-server` ya tiene Socket.IO montado. Aprovechamos para refrescar la consola en tiempo real **sin que el cliente reciba datos por socket**:

1. El backend emite eventos chiquitos (`{ type, id }`) cuando algo cambia (KYC nuevo, payment fail, terminal disconnect, etc.).
2. El cliente escucha vía [`src/hooks/useRealtimeInvalidation.ts`](src/hooks/useRealtimeInvalidation.ts).
3. El handler **no muta cache directamente**. Sólo llama `queryClient.invalidateQueries(['superadmin', ...])`.
4. TanStack Query refetch del endpoint REST → cache actualizada → UI re-renderea.

Ventajas: un único path de datos (REST → cache), permisos siguen en la capa REST, dedup automática, escala sin que cada cliente reciba payloads grandes por socket.

Cuando agregues una página/feature nueva al superadmin:

1. Define el evento del backend (ej. `superadmin:venue:updated`).
2. Mapéalo en `EVENT_INVALIDATIONS` con las query keys afectadas.
3. El hook se encarga del resto.

El socket sólo conecta cuando hay sesión superadmin activa y se desconecta automáticamente en logout (handled by `AuthContext` + `disconnectSocket`).

### API evolution policy (read this every time you touch an endpoint)

`avoqado-web-dashboard` also consumes some of these endpoints. To avoid breaking that consumer:

1. **Additive only.** Adding optional fields, new endpoints, new optional query params: OK. Removing fields, renaming fields, changing types, changing field semantics: **prohibited**.
2. **Per-endpoint sub-version** when the shape genuinely needs to change. The route gets a `/v2` suffix (`GET /superadmin/venues/v2`). The old endpoint stays alive until the old dashboard migrates.
3. **Never create a parallel `/superadmin-v2/*` namespace.** That duplicates ~25 routers with zero value.

If you find yourself wanting to "just rename one field," stop and add a new one instead.

### ActivityLog registration (write side)

Whenever you implement a write operation that mutates state of value (creates a venue, approves KYC, changes commission, lanza un update de TPV, etc.), **also** register the action in the activity log (server-side, via the existing activity-log service). This is non-negotiable: la trazabilidad operativa de Avoqado depende de eso.

---

## Design — read this before any UI work

The repo has a `.impeccable.md` at the root that defines the design system, palette, typography, and the aesthetic commitments ("Editorial Operations Terminal"). **You must read it before designing any new screen or component.**

### Hard rules

- **Dark theme es el default.** Las variables de `:root` son dark. La paleta light queda en la clase `.light` por si en el futuro necesitamos toggle — hoy NO está expuesta en UI. Si tu cambio asume light, lo más probable es que esté mal.
- **Todo `<button>` no-disabled tiene `cursor: pointer`** vía el base layer de `src/index.css` (Tailwind v4 lo quitó del default). No lo agregues por componente.
- **`impeccable:audit` is mandatory** after any visible UI change. Run it before pushing. If the audit surfaces severity ≥ "high" issues, fix them in the same PR.
- **`impeccable:frontend-design`** is the skill to invoke when designing a new screen or component from scratch (loads the design protocol + the AI slop test).
- **`impeccable:polish`** is the skill to run as the final pass before shipping a page to production (or before review).
- **Never invent fonts.** Only the three families declared in `.impeccable.md` (Bricolage Grotesque variable, Plus Jakarta Sans variable, JetBrains Mono) — added via `@fontsource-variable/*`.
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

- **Always import from [`src/lib/datetime.ts`](src/lib/datetime.ts).** Never call `new Date().toLocaleString()` or instantiate `luxon` ad-hoc.
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
| **Unit** (Vitest)                    | Helpers puros (`src/lib/datetime.ts`), `cn()`, validadores zod.                                         | Co-localizado: `foo.test.ts` junto a `foo.ts`. |
| **Component** (Vitest + RTL)         | UI primitive con lógica visible (`Button`, `Badge`, `Field`).                                           | Co-localizado: `Component.test.tsx`.           |
| **Integration** (Vitest + RTL + MSW) | Página + datos + auth (`LoginPage`, `DashboardPage`). MSW mockea `/dashboard/auth/*` y `/superadmin/*`. | Co-localizado o en `src/pages/__tests__/`.     |
| **E2E** (Playwright)                 | Flujos completos contra el dev server real.                                                             | `e2e/*.spec.ts`.                               |

### Conventions

- Usa `renderWithProviders` de [`src/test/render.tsx`](src/test/render.tsx) — incluye `QueryClient`, `MemoryRouter`, `AuthProvider` listos para usar.
- Mocks de API van en [`src/test/mocks/handlers.ts`](src/test/mocks/handlers.ts). Por defecto las queries fallan (queries devuelven `authenticated: false`). En el test específico usa `server.use(http.post(...))` para sobrescribir.
- **Lock al TZ**: `process.env.TZ = 'America/Mexico_City'` ya está en `src/test/setup.ts`. Si necesitas un TZ distinto, hazlo dentro del test con `vi.stubEnv('TZ', '...')` y restaura en `afterEach`.
- Coverage threshold: 60 % lines / functions / statements, 55 % branches. Si el cambio baja la cobertura, **agrega tests** (no bajes el threshold).

---

## File / code conventions

- **TypeScript strict** — no `any` salvo con comentario justificando. Prefiere `unknown` + narrow.
- **No barrel files** para componentes o páginas — mantén imports explícitos.
- **Routes** viven en `src/router/index.tsx`. Nueva page = nuevo archivo bajo `src/pages/` + entry en el router. **Toda nueva ruta debe ser `lazy()` + integrarse al `<Suspense>` ya configurado.**
- **API hooks** colocados junto a la página que los consume (`src/pages/Venues/useVenues.ts`) salvo que los reusen ≥2 páginas — entonces a `src/hooks/`.
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
- Mezclar `axios` y `fetch` — solo `api` desde `src/lib/api.ts`.
- Hardcodear URLs de API — solo `VITE_API_URL` vía el `api` client.
- Saltarse el pre-push hook (`git push --no-verify`) sin razón documentada.

---

## Workflow expectations

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

---

## Quick reference

| What                | Where                                              |
| ------------------- | -------------------------------------------------- |
| API client          | `src/lib/api.ts`                                   |
| Auth service        | `src/services/auth.service.ts`                     |
| Auth context        | `src/context/AuthContext.tsx`                      |
| Datetime helpers    | `src/lib/datetime.ts`                              |
| Class merge `cn()`  | `src/lib/utils.ts`                                 |
| Layout (sidebar)    | `src/components/layouts/AppLayout.tsx`             |
| Command Palette     | `src/components/CommandPalette.tsx`                |
| Error Boundary      | `src/components/ErrorBoundary.tsx`                 |
| Routes              | `src/router/index.tsx`                             |
| Design context      | `.impeccable.md`                                   |
| Test setup          | `src/test/setup.ts` + `src/test/mocks/handlers.ts` |
| Test render wrapper | `src/test/render.tsx`                              |
| E2E specs           | `e2e/*.spec.ts`                                    |
| CI workflow         | `.github/workflows/ci.yml`                         |
