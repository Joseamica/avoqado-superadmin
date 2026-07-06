# avoqado-superadmin — Project Instructions

This file overrides default behavior for any AI assistant working on this repository. Read [CLAUDE.md del workspace](../CLAUDE.md) for ecosystem-wide rules; this file adds project-specific rules on top.

---

## 🔴 CRITICAL — Ask which payment tier BEFORE building or changing anything

Avoqado is a tier-gated SaaS (**FREE · PRO · PREMIUM · ENTERPRISE**). Whenever you add a new
feature, modify existing behavior, or expose a new capability, **STOP and ask the founder which
paid tier it falls under** — then wire the gating to match. A change shipped without a tier
decision is unfinished: it either leaks paid value into a lower tier or hides a free capability
behind a paywall. (Superadmin is where tiers/features get activated per venue — be especially
deliberate here.)

- **Backend (authoritative):** `avoqado-server/src/services/access/basePlan.service.ts` +
  `avoqado-server/src/middlewares/checkFeatureAccess.middleware.ts`. Obligatory gating questions:
  `avoqado-server/.claude/rules/feature-gating.md`. PREMIUM-only codes today: `CFDI`, `INVENTORY_TRACKING`.
- **Dashboard display/CTA map:** `avoqado-web-dashboard/src/config/plan-catalog.ts`
  (`TierId`, `PLAN_TIERS`, `getTierForFeature()` → FeatureGate upsell).
- **Enforcement status:** ✅ only **avoqado-web-dashboard** enforces tiers today.
  ⚠️ **avoqado-ios** and **avoqado-android** have NO tier gating yet — they will mirror the backend
  feature codes by exact name. Treat tier codes like permissions: a name mismatch fails silently.

---

## Backend it talks to

This app is the **superadmin frontend** for the Avoqado platform. It calls **`avoqado-server`** at the existing namespace **`/api/v1/superadmin/*`** (already protected by `authenticateTokenMiddleware` + `authorizeRole([StaffRole.SUPERADMIN])`). There is **no** separate server, **no** parallel database, **no** namespace `v2` by default.

### Namespace rule — el front sólo llama `/api/v1/superadmin/*` (NUNCA `/dashboard/superadmin/*`)

**Regla dura:** este front consume **únicamente** endpoints bajo `/api/v1/superadmin/*`. La **única** excepción es auth (`/api/v1/dashboard/auth/*`) — la sesión es compartida a propósito y no se duplica (ver más abajo).

**Prohibido** llamar `/api/v1/dashboard/superadmin/*` (ni ningún otro `/dashboard/*` que no sea auth), **aunque el endpoint exista y "funcione"**. Esas son las rutas del **dashboard legacy**: si las consumimos quedamos acoplados a ellas — un cambio del legacy nos rompe, y cuando el router está montado en ambos lados (double-mount), un cambio nuestro rompe al legacy.

**Si necesitas algo que hoy sólo existe en `/dashboard/superadmin/*`:** no lo consumas desde ahí. **Copia** la lógica del controller/service del legacy a una **ruta nueva montada bajo `/superadmin/*`** (en `avoqado-server/src/routes/superadmin.routes.ts`) y apunta el front a `/superadmin/*`. Duplicar un handler chico es barato; el acoplamiento al legacy es caro.

- **Endpoints nuevos** → nacen directo en `/superadmin/*`, nunca en `/dashboard/superadmin/*`.
- **Endpoints ya double-mounted** (mismo router en ambos paths — ej. `terminals`, `payment-providers`, `payment-analytics`): el front usa **siempre** la variante `/superadmin/*`, nunca la `/dashboard/*`.
  **Cómo construir un endpoint nuevo (referencia → reusar o copiar):**

1. **Siempre lee primero la implementación legacy como referencia.** El comportamiento correcto ya está ahí — no lo inventes ni lo adivines; replícalo.
2. **Crea una ruta nueva** bajo `/superadmin/*` (nunca llames la legacy).
3. **Reusa tal cual** el service/util/helper compartido que el legacy ya usa (impórtalo) cuando el comportamiento debe ser **idéntico** — no dupliques lógica que ya vive en un módulo reusable (ej. `paymentAnalyticsService`, helpers de Prisma).
4. **Copia (forkea a una función nueva)** sólo cuando: (a) la lógica vive _inline_ dentro del controller legacy (no está extraída a un service reusable), o (b) el nuevo app necesita comportamiento **distinto** al legacy.

**Regla de oro:** reusar un service compartido **sin modificarlo** = seguro (no tocas al legacy). Si necesitas **cambiar** esa lógica compartida → **forkea primero** (función nueva), porque modificar el service compartido rompería al legacy.

- **Por qué (decoupling):** el objetivo es que el dashboard legacy pueda cambiar o morir sin tocar este app, y viceversa. Un endpoint `/superadmin/*` independiente evoluciona libre; uno compartido te ata a la disciplina aditiva del legacy para siempre.

> **Deuda conocida (2026-05-26):** `venues`, `features`, `ecommerce-merchants` y los TPV `command`/`settings` aún se consumen vía `/dashboard/*`. `terminals` y `app-updates` ya están double-mounted (sólo falta cambiar el string del path en el front). Migrar todo a `/superadmin/*` es trabajo pendiente trackeado; **no agregar más usos de `/dashboard/superadmin/*` mientras tanto.**

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
2. **Editorial density, never Bloomberg ugliness.** La tipografía conduce el layout y espeja al dashboard principal: **Inter** en el contenido (default global, incluidos overlays portaleados), **Geist** en el shell/sidebar (override de `--font-sans` en el `<aside>`), **Geist Mono** para datos. La jerarquía sale del peso/tamaño y del contraste sans-vs-mono, no de una fuente display. Ritmo variado: secciones respiran, tablas compactan; "mismo padding everywhere" es flat.
3. **GitHub Dark, not corporate.** Paleta GitHub Dark (`#0d1117` canvas, acento **neutro `#e6edf3`** sin hue; azul `#58a6ff` reservado a `--info`). Botón primario = `bg-white text-black`. Badges pill-shaped sin bordes. Sin gradientes, sin neón, sin glassmorphism. Se siente herramienta personal, no producto enterprise.
4. **Numerals are data, not decoration.** `tabular-nums` siempre; montos a la derecha; status pills (`<Badge>`) semánticas **sin borde** — el color codifica juicio (success/warn/danger/info), los tipos/clasificaciones van `muted`. Sparklines sólo si el trend es información esencial — nunca como garnish.
5. **Empty states teach the interface.** "No hay KYC pendientes. Última revisión hace 3 h" en vez de "Nothing here". Cada vacío explica qué hace la pantalla, qué espera, y qué pasó por última vez.

### Error handling — nunca un "No pudimos" genérico

Todo error de TanStack Query (o de cualquier `await api.*`) que se muestre en UI debe pasar por:

1. **`inspectApiError(error, context?)`** en [`src/shared/lib/api-error.ts`](src/shared/lib/api-error.ts) — categoriza el error (network / 401 / 403 / 404 / 422 / 5xx / unknown) y devuelve `{ kind, title, description, serverMessage? }`.
2. **`<QueryError error={...} context="cargar el resumen" onRetry={() => query.refetch()} />`** en [`src/shared/components/QueryError.tsx`](src/shared/components/QueryError.tsx) — UI consistente con título específico, descripción accionable, detalle técnico expandible y botón "Reintentar".

**Prohibido**: escribir un `<div role="alert">No pudimos…</div>` ad-hoc. Esto fuerza que cada error diga **qué pasó** (sin conexión vs 500 vs 403 vs validación) y **qué puede hacer el usuario** (recargar, esperar, escribir a ops, reportar).

Para **errores de mutations** (clicks de botón), usa `toast.error(title, { description })` alimentado por `inspectApiError`.

### Hard rules

- **Dark theme es el default.** Las variables de `:root` son dark. La paleta light queda en la clase `.light` por si en el futuro necesitamos toggle — hoy NO está expuesta en UI. Si tu cambio asume light, lo más probable es que esté mal.
- **Mobile first / mobile friendly** — el operador usa esta consola desde móvil también:
  - Touch targets mínimos: 36 px de alto (`h-9`) para acciones secundarias, 44 px (`h-11`) para CTA principales.
  - El sidebar fijo desaparece en `< md`; usa el `MobileTopBar` + drawer del `AppLayout`.
  - Las tablas viven dentro de un `overflow-x-auto`; nunca rompen viewport.
  - Texto base ≥ 13 px; nunca uses 10 px para datos críticos.
  - Para labels pequeños / headers usa los **utilities tipográficos** (`eyebrow`, `label` en `src/app/index.css`), no px inline; para pills/etiquetas usa el componente **`<Badge size="sm">`**. El tamaño/forma/casing vive en el primitive — un solo lugar. NO hardcodees `text-[10.5px] uppercase tracking-[…]` a mano; eso fue justo el smell que se eliminó. Sentence case por default (sin `uppercase` salvo wordmarks de marca).
  - Forms en mobile: campos full-width, label encima del input, botón CTA full-width.
- **Reuse-or-promote — no hardcodees patrones recurrentes.** Antes de escribir markup/estilos inline para algo que se repite (label, badge, botón, card, sección, empty state): ¿ya existe un primitive? → componente en [src/shared/ui/](src/shared/ui/) (`Button`, `IconButton`, `Badge`, `Combobox`, `Drawer`, `DataTable`…) o `@utility` en [src/app/index.css](src/app/index.css) (`eyebrow`, `label`, `display`, `tabular`) → **úsalo**. ¿Patrón nuevo que aparece ≥2 veces? → **promuévelo** a primitive (componente o `@utility`), no lo dejes inline en cada página. Magic numbers de tamaño/spacing/color inline (`text-[10.5px]`, `tracking-[…]`, etc.) = **rechazo en review** — el tamaño/forma/casing vive en el primitive, en un solo lugar. Las reglas de abajo (Button / DataTable / Combobox / Drawer únicos) son casos concretos de este principio.
- **Button es el componente único para CUALQUIER CTA / acción**: [src/shared/ui/Button.tsx](src/shared/ui/Button.tsx). **NUNCA** escribas clases inline tipo `bg-white text-[var(--canvas)] hover:bg-white/90 ...` ni `bg-[var(--surface-primary)] ...` a mano. Si necesitas un look diferente, **agrega una variant al componente** — no inline. Cuando el elemento debe ser un `<Link>` de react-router (navegación, no click handler), usa `buttonVariants({ size, variant, className })` de [src/shared/ui/button-variants.ts](src/shared/ui/button-variants.ts): `<Link to="/x" className={buttonVariants({ size: 'lg' })}>`. Los tokens semánticos `--surface-primary` / `--surface-primary-hover` / `--on-surface-primary` viven en [src/app/index.css](src/app/index.css) — si el primario un día deja de ser blanco, cambias un token y todos los CTAs siguen. Test de regresión: `grep -rn "bg-white" src/` debe devolver SOLO comentarios.
- **IconButton es el componente único para botones icon-only**: [src/shared/ui/IconButton.tsx](src/shared/ui/IconButton.tsx) (acciones de fila, copy, abrir, menú, cerrar). Cuadrado, `rounded-[6px]`, icono tenue que se ilumina elevando la superficie en hover; `size="sm"` (h-7) / `md` (h-8). Para un `<Link>`/`<a>` con el mismo look usa `iconButtonVariants({ size })` de [src/shared/ui/icon-button-variants.ts](src/shared/ui/icon-button-variants.ts). Siempre con `aria-label`. **NUNCA** armes un icon button inline con `h-7 w-7 rounded-[4px] hover:bg-…` a mano. El estado "seleccionado/activo" se pinta con superficie elevada (`bg-[var(--canvas-raised)]` + icono `--ink`), **nunca blanco** (`--surface-primary` es sólo para el CTA primario) — ver `SetupIcons` como referencia de estados ok/missing/unknown.
- **Badge es el componente único para CUALQUIER pill / etiqueta**: [src/shared/ui/Badge.tsx](src/shared/ui/Badge.tsx). Status ("Activo"), tipo ("TPV Android"), micro-tags ("Se encolará"), indicadores ("Live") — todos `<Badge tone={…} size="sm"|"md">`. **Siempre pill (`rounded-full`), sin borde**, tint del tono. NUNCA armes un badge inline con `rounded-[3px]/[4px]`, `border` + `bg-[…]` a mano — eso fue justo el desorden que se centralizó. Acepta icono como child (`gap-1` ya separado). Test de regresión: no debe haber `<span>` con `rounded-[3px]`/`rounded-[4px]` + `bg-[var(--*-faint)]` que sea un badge.
  - **El tono codifica un juicio, no la identidad**: `success`=saludable (Activo), `warn`=atención/transitorio (Pendiente, Mantenimiento), `danger`=error/bloqueado, `info`=dato neutro (con parsimonia), `muted`=sin juicio → **tipos/clasificaciones** (TPV Android, KDS, Inactivo). Colorear un tipo (porque "se vea distinto") es ruido — va `muted`. Reserva el color para estados que importan.
- **DataTable es el componente único para listas**: [src/shared/data-table/DataTable.tsx](src/shared/data-table/DataTable.tsx). Sortable headers, búsqueda global, paginación, export CSV con dialog (rango de fechas + selección de columnas). Cualquier nueva página de listado debe usar este componente — no escribir `<table>` a mano.
- **Combobox es el componente único para CUALQUIER dropdown / single-select del repo**: [src/shared/ui/Combobox.tsx](src/shared/ui/Combobox.tsx). **NUNCA** uses `<select>` HTML nativo, ni `<option>`, ni `<optgroup>`. Tampoco armes dropdowns custom con div+button. Aplica incluso para 2 opciones (binarios como Persona Física/Moral) — consistencia visual gana sobre minimalismo de markup. Reglas no-negociables: (1) trigger visiblemente padre — borde sólido, indica claramente que abre; (2) **search siempre visible** en el popover, sin búsqueda no es Combobox; (3) **scroll vertical** del list con `max-h-[260px]` y `overflow-y-auto`; (4) empty state explícito; (5) `allowCustomValue` opcional para versions/slugs/IDs futuros (el typed text se acepta tal cual con un banner accent "Usar `valor`"); (6) `description` por opción cuando aporta contexto (categoría, venueCount, environment, etc.); (7) `searchTokens` cuando quieres que un término secundario matchee la búsqueda (ej. "tienda" matcheando todos los retail types). Construido sobre `cmdk` + Radix Popover.
- **Multi-select**: para sets de valores múltiples (filtros con check-checks), usar `FilterPill` + `MultiSelectFilterContent` en [src/shared/filters/](src/shared/filters/). NO armar multi-selects custom.
- **DateRangePicker es el componente único para CUALQUIER selector de rango de fechas**: [src/shared/ui/DateRangePicker.tsx](src/shared/ui/DateRangePicker.tsx). Dual-calendar estilo booking de aerolínea (dos meses lado a lado, click inicio → click fin → rango visual). Soporta presets rápidos (`presets` prop), inputs de hora opcionales (`showTime`), y conversión timezone-aware (display en local, retorna UTC ISO 8601). Dentro de un `FilterPill` usar `popoverClassName="w-auto"` para que el popover se ajuste al ancho del calendar. Standalone: el componente incluye su propio header + footer (Limpiar/Aplicar). **NUNCA** uses `<input type="date">` nativos para rangos de fecha, ni armes calendarios custom — este componente ya lo resuelve. El helper `formatDateRangeLabel(range, timezone?)` genera el label legible para el FilterPill. Exporta `DateRangeValue`, `DateRangePreset` como tipos reutilizables.
- **Drawer es el componente único para overlays laterales**: [src/shared/ui/Drawer.tsx](src/shared/ui/Drawer.tsx). 640px de default, full-screen en mobile. Para forms largos o acciones secundarias sobre una entidad (acciones de terminal, etc.). NO uses `Dialog` modal cuando el contexto debe preservarse — el drawer mantiene la lista atrás visible.
- **Todo `<button>` no-disabled tiene `cursor: pointer`** vía el base layer de `src/index.css` (Tailwind v4 lo quitó del default). No lo agregues por componente.
- **`impeccable:audit` is mandatory** after any visible UI change. Run it before pushing. If the audit surfaces severity ≥ "high" issues, fix them in the same PR.
- **`impeccable:frontend-design`** is the skill to invoke when designing a new screen or component from scratch (loads the design protocol + the AI slop test).
- **`impeccable:polish`** is the skill to run as the final pass before shipping a page to production (or before review).
- **Never invent fonts.** Only the three families declared in `.impeccable.md` (Geist Variable, Inter Variable, Geist Mono Variable) — added via `@fontsource-variable/*`. Inter = contenido (default global, incluidos overlays portaleados), Geist = shell (override de `--font-sans` en el `<aside>` del `AppLayout`), Geist Mono = datos.
- **Never use** the AI slop patterns enumerated in `.impeccable.md`: glassmorphism, purple-to-blue gradients, cyan-on-dark, indigo/purple accents, sparklines as decoration, nested cards, hero-metric template, bouncy easings.
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

#### 🔴 Node version — `npm run check`/`test` requiere Node ^22.12 || >=23 (jsdom + require(esm))

`jsdom`'s `html-encoding-sniffer` depende de `@exodus/bytes`, que es **ESM-only** (`"type": "module"`,
sin build CJS). `html-encoding-sniffer` lo carga con `require()` plano — eso solo funciona en
versiones de Node con soporte estable de `require(esm)` (22.12+/23.x/24+). En Node ≤21 (incluido
21.x, que quedó **fuera** del rango soportado a propósito) truena con un `ERR_REQUIRE_ESM` críptico
la primera vez que Vitest arranca el entorno `jsdom` — se ve como si los tests estuvieran rotos,
pero es 100% la versión de Node activa, no el código.

- **Guardado en `engines` de `package.json`** (`^22.12.0 || >=24.0.0`) + `.npmrc` (`engine-strict=true`)
  — falla claro en `npm install` con Node incompatible.
- **`scripts/check-node-version.mjs`** corre como hook `pretest`/`pretest:run`/`pretest:coverage` —
  bloquea con un mensaje accionable **cada vez** que corres los scripts, sin importar cuándo se instaló
  `node_modules` ni qué version manager (`n`, `nvm`, `asdf`) esté shadowing el `node` del PATH.
- **Si te truena igual:** confirma qué `node` está activo (`which -a node`, `node --version`) —
  en esta máquina `n` deja un `node` viejo en `/usr/local/bin` que gana por orden de PATH sobre el
  `node` correcto de Homebrew en `/opt/homebrew/bin`. Corre explícito:
  `PATH="/opt/homebrew/bin:$PATH" npm run check`.

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
- **Un solo server MSW por test file — nunca dos.** `setup.ts` NO hace `server.listen()` global: el file que use el server global debe llamar `installGlobalServer()` (de [`src/test/mocks/server.ts`](src/test/mocks/server.ts)) en top-level; el file que arranque su propio `setupServer()` NO llama el helper. Dos servers escuchando a la vez duplican el handler lookup de cada request — en CI Linux eso pierde una race y llena los logs de `TypeError: Body is unusable`.
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
- Llamar `/api/v1/dashboard/superadmin/*` (o cualquier `/dashboard/*` que no sea auth). El front sólo consume `/superadmin/*`; si algo sólo existe en legacy, **copia** el handler a una ruta `/superadmin/*` nueva. Ver "Namespace rule" arriba.
- Importar `firebase/*` (auth es interno; Firebase no está en deps).
- `new Date(...)` seguido de `.toLocaleString()` (usa `datetime.ts`).
- `console.log` committeado (sólo `console.warn` / `console.error` están permitidos por ESLint).
- `// eslint-disable` sin un comentario al lado explicando por qué.
- Mezclar `axios` y `fetch` — solo `api` desde `src/shared/lib/api.ts`.
- Hardcodear URLs de API — solo `VITE_API_URL` vía el `api` client.
- Saltarse el pre-push hook (`git push --no-verify`) sin razón documentada.
- Escribir clases de botón inline (`bg-white`, `bg-[var(--surface-primary)]`, `bg-[var(--accent)] text-white`, etc.) en lugar de usar `<Button>` o `buttonVariants()`. Si necesitas un look nuevo, agrega una variant — no duplique clases.
- Usar `bg-white` literal en cualquier archivo `.tsx` (debe ser `var(--surface-primary)` o pasar por `<Button>`).

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
| Button (component)  | `src/shared/ui/Button.tsx`                           |
| `buttonVariants()`  | `src/shared/ui/button-variants.ts` (para `<Link>`)   |
| Layout (sidebar)    | `src/shared/layouts/AppLayout.tsx`                   |
| Command Palette     | `src/shared/components/CommandPalette.tsx`           |
| Error Boundary      | `src/shared/components/ErrorBoundary.tsx`            |
| DateRangePicker     | `src/shared/ui/DateRangePicker.tsx`                  |
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

## 🔴 CRITICAL — Keep the Avoqado MCP in sync

The Avoqado MCP (`avoqado-server/scripts/mcp/`) is a **first-class interface**: it exposes
the platform's data and actions to AI agents (internal ops today, customer-facing tomorrow).
It must never fall behind the platform.

**Whenever you add or change a feature, Prisma model, service, endpoint, permission, or any
capability the MCP should expose, you MUST add or update the matching MCP tool in
`avoqado-server/scripts/mcp/` as part of the SAME change — never "later".** A capability that
exists but isn't reachable through the MCP is unfinished. Treat the MCP like permissions: kept
in lockstep, never an afterthought.

## 🔴 CRITICAL — Keep the sales presentation in sync

The partner sales presentation (`~/Documents/Programming/Avoqado-HQ/operations/marketing/platform-presentation/`)
is the canonical "what Avoqado does" document — third parties sell from it. It must never fall
behind the platform.

**Whenever you add, change, or remove a customer-visible capability (feature, module, product,
payment method, supported sector, tier packaging), you MUST update BOTH deliverables as part of
the SAME change — never "later":** the full deck (`avoqado-presentacion.html`) AND the one-pager
(`avoqado-one-pager.html`), then regenerate both PDFs following that folder's `README.md`.
Updating only one of the two is an incomplete change. Internal refactors and bugfixes with no
customer-visible impact are exempt.

---

## Fetching Asana task attachments / screenshots

When given an Asana task URL, you **can** see its screenshots and attachments — don't claim you can't.

- `mcp__asana__*` reads task text/comments but **not** files; the `mcp__claude_ai_Asana__` connector is often unauthorized. Don't stop there — use the Asana Personal Access Token directly (it's what powers the `asana` MCP server):
  1. Read the token (use it, **never print or commit the value**): key `ASANA_ACCESS_TOKEN` under `mcpServers.asana.env` in `~/.claude.json`. Example:
     `TOKEN=$(python3 -c "import json,os; print(json.load(open(os.path.expanduser('~/.claude.json')))['mcpServers']['asana']['env']['ASANA_ACCESS_TOKEN'])")`
  2. List attachments + signed URLs (task GID = the long number after `/task/` in the URL):
     `curl -s -H "Authorization: Bearer $TOKEN" "https://app.asana.com/api/1.0/tasks/<GID>/attachments?opt_fields=name,download_url,created_at"`
  3. `curl` each `download_url` (pre-signed, needs no auth) to a temp file in the scratchpad, then Read the image. Inline description images are attachments too, so this returns all of them — not just the ones embedded in the text.
- If slide/screenshot text is unreadable after Read downscales a large image, crop it into regions with PIL and upscale (LANCZOS) before re-reading.
