# avoqado-superadmin — Project Instructions

This file overrides default behavior for any AI assistant working on this repository. Read [CLAUDE.md del workspace](../CLAUDE.md) for ecosystem-wide rules; this file adds project-specific rules on top.

---

## Backend it talks to

This app is the **superadmin frontend** for the Avoqado platform. It calls **`avoqado-server`** at the existing namespace **`/api/v1/superadmin/*`** (already protected by `authenticateTokenMiddleware` + `authorizeRole([StaffRole.SUPERADMIN])`). There is **no** separate server, **no** parallel database, **no** namespace `v2` by default.

### API evolution policy (read this every time you touch an endpoint)

`avoqado-web-dashboard` also consumes some of these endpoints. To avoid breaking that consumer:

1. **Additive only.** Adding optional fields, new endpoints, new optional query params: OK. Removing fields, renaming fields, changing types, changing field semantics: **prohibited**.
2. **Per-endpoint sub-version** when the shape genuinely needs to change. The route gets a `/v2` suffix (`GET /superadmin/venues/v2`). The old endpoint stays alive until the old dashboard migrates.
3. **Never create a parallel `/superadmin-v2/*` namespace.** That duplicates ~25 routers with zero value.

If you find yourself wanting to "just rename one field," stop and add a new one instead.

---

## Design — read this before any UI work

The repo has a `.impeccable.md` at the root that defines the design system, palette, typography, and the aesthetic commitments ("Editorial Operations Terminal"). **You must read it before designing any new screen or component.**

### Hard rules

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
- Tests for date-rendering components should pin the timezone explicitly — don't depend on the runner's local TZ.

---

## File / code conventions

- **TypeScript strict** — no `any` unless commented with rationale. Prefer `unknown` + narrow.
- **No barrel files** for components or pages — keep imports explicit.
- **Routes** live in `src/router/index.tsx`. New page = new file under `src/pages/` + entry in the router.
- **API hooks** colocated near the page that consumes them (`src/pages/Venues/useVenues.ts`) unless reused by ≥2 pages — then move to `src/hooks/`.
- **Mock data is allowed during scaffolding**. Any mock data file must (a) live next to the page that uses it, (b) be named `*.mock.ts`, (c) contain a `// TODO(api):` comment pointing to the real endpoint.
- **shadcn primitives**: when a Radix-based primitive matches what we need, install via `npx shadcn@latest add` and then **restyle to match the design system** (don't ship the default look — it's recognizably AI-generic).
- **No `useEffect`** for derived state. Compute during render.

---

## Forbidden patterns (instant rejection)

- Calling `/api/v1/admin/*` (the namespace doesn't exist — use `/superadmin`).
- `new Date(...)` followed by `.toLocaleString()` in a component (use `datetime.ts`).
- `console.log` left in committed code.
- `// eslint-disable` without a reason on the next line.
- Mixing `axios` and `fetch` — only `api` from `src/lib/api.ts`.
- Hardcoding API URLs — only `VITE_API_URL` via the `api` client.
- Importing Firebase outside `src/lib/firebase.ts` or `src/context/AuthContext.tsx`.

---

## Workflow expectations

- **Build before pushing**: `npm run typecheck && npm run build` must pass.
- **Lint**: `npm run lint` clean.
- **No secrets**: never commit `.env*`. `.env.example` is the only env file in the repo.
- **Commits**: small, focused, present tense (`feat:`, `fix:`, `chore:`, `refactor:`). Co-author tag for AI-assisted commits.

---

## Quick reference

| What | Where |
|------|-------|
| API client | `src/lib/api.ts` |
| Firebase init | `src/lib/firebase.ts` |
| Auth context | `src/context/AuthContext.tsx` |
| Datetime helpers | `src/lib/datetime.ts` |
| Class merge `cn()` | `src/lib/utils.ts` |
| Layout (sidebar) | `src/components/layouts/AppLayout.tsx` |
| Routes | `src/router/index.tsx` |
| Design context | `.impeccable.md` |
