<!--
Antes de abrir el PR confirma:
- npm run check pasa local (lint + typecheck + tests)
- Si tocaste UI, corriste /impeccable:audit y resolviste severity ≥ high
- Si tocaste un endpoint, respetaste la política de evolución aditiva (CLAUDE.md)
- Si agregaste/modificaste auth, env vars, scripts o flujos, actualizaste el README
-->

## ¿Qué hace este PR?

<!-- Una o dos frases en presente: "Agrega tabla de venues con filtros por estado y paginación server-side." -->

## ¿Por qué?

<!-- Contexto operativo: ticket, incidente, decisión. -->

## Cómo lo probaste

- [ ] `npm run check` local pasa
- [ ] Tests nuevos para la lógica modificada (Vitest / Playwright según aplique)
- [ ] Probado manualmente en el dev server (`npm run dev`)
- [ ] Si toca UI: corrí `/impeccable:audit` y los issues ≥ high están resueltos
- [ ] Si toca endpoints: respeté la política aditiva del CLAUDE.md
- [ ] Actualicé README / CLAUDE.md si el cambio es observable por otro humano

## Screenshots / video (si aplica UI)

<!-- Pega antes/después o un GIF corto. -->

## Notas para el reviewer

<!-- Decisiones específicas, tradeoffs, dependencias en otros PRs, riesgos. -->
