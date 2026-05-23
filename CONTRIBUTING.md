# Contribuir a avoqado-superadmin

Antes de tu primera contribución lee:

1. **[CLAUDE.md](CLAUDE.md)** — reglas de proyecto que aplican a humanos y a agentes IA.
2. **[.impeccable.md](.impeccable.md)** — dirección de diseño y anti-patrones prohibidos.
3. **[README.md](README.md)** — stack, scripts, setup.

## Setup rápido

```bash
nvm use
cp .env.example .env
npm install
npm run dev
```

## Antes de pushear

```bash
npm run check
```

El `pre-push` hook corre lo mismo automáticamente. Si tocaste UI, además invoca `/impeccable:audit`.

## Convenciones de commits

Presente, focused, prefijo semántico:

- `feat: …` — feature nueva
- `fix: …` — bug fix
- `chore: …` — mantenimiento (deps, build, configs)
- `refactor: …` — sin cambio de comportamiento
- `test: …` — tests
- `docs: …` — README / CLAUDE.md / comentarios
- `perf: …` — performance

Para commits asistidos por IA, agrega el trailer `Co-Authored-By: <modelo>`.

## Branch policy

- `main` es protegido — sólo se merge vía PR aprobado y CI verde.
- Branches feature: `feat/<scope>-<verb>` (ej. `feat/venues-list`).
- Branches fix: `fix/<scope>-<verb>` (ej. `fix/login-redirect-loop`).

## Política de PRs

- Usa el [PR template](.github/PULL_REQUEST_TEMPLATE.md).
- CI debe pasar (lint, typecheck, tests, build, e2e).
- Al menos 1 review aprobado.
- Si el PR tiene >400 líneas, considera partirlo.

## Reportar bugs / pedir features

Issues en GitHub, label `bug` o `feature`. Para vulnerabilidades de seguridad, lee [SECURITY.md](SECURITY.md) — **no abras issue público**.
