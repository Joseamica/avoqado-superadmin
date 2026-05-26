# Changelog

Todos los cambios notables de este proyecto se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) y respeta
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Regla**: cada PR que cambie algo observable (UI, scripts, deps, env, flujos)
debe actualizar la sección `[Unreleased]` aquí en el mismo commit. Sin excepción.

## [Unreleased]

### Added

- **Merchant accounts (F5·B):** panel de alta guiada AngelPay en `/merchants/new-angelpay` (login existente/nuevo + merchant + slot fill/replace → un POST a `full-setup-angelpay`); `CardDrawer`/`RatesDrawer` extraídos a `SetupDrawerKit` (reusados por ambos paneles); `logAction` en el full-setup AngelPay.
- **Merchant accounts (F5·A):** panel de alta guiada Blumon en `/merchants/new` (cards de estado con gating + progreso "X de 4 obligatorios" → un POST a `blumon/full-setup` con auto-fetch de credenciales); `logAction` en el full-setup.
- **Merchant accounts (F4):** pantalla venue-céntrica `/venues/:id/merchant` para asignar cuentas a los slots primary/secondary/tertiary del venue + preferredProcessor (con hint de compatibilidad de hardware Blumon→PAX / AngelPay→NexGo); `logAction` en venuePaymentConfig.
- **Merchant accounts (F3):** edición de liquidación (días D+N por tarjeta + tipo hábiles/naturales + corte) desde `/merchants/:id` con estimado de fecha de depósito (excluye fines de semana + feriados de `date.nager.at`, cacheados en `HolidayCalendar` vía el nuevo endpoint `GET /superadmin/holidays`); `logAction` server-side en settlement-configurations.
- **Merchant accounts (F2):** edición de costo del proveedor, revenue-share (split directa/agregador) y pricing por venue/slot desde `/merchants/:id`, con preview de margen en vivo (`CardRatesInput` en %, `MarginPreview`); `logAction` server-side en cost-structures / venue-pricing / merchant-revenue-shares.
- **Merchant accounts (F1B):** alta manual / editar identidad / activar-desactivar / borrar (con aviso de cascada) desde `/merchants`; `logAction` server-side en las mutaciones de merchant (avoqado-server); a11y: `ReadinessStrip` anuncia estado a lectores de pantalla y el `Combobox` acepta `ariaLabel`.
- **Merchant accounts (F1A):** página `/merchants` (listado) y detalle `/merchants/:id` de sólo lectura que hace legible la economía (costo proveedor → split agregador → margen Avoqado) + readiness por cuenta. Consume `/api/v1/superadmin/*` (los endpoints `merchant-revenue-shares` y `settlement-configurations` ahora se montan también ahí en el server).
- **Página `/terminals/:terminalId/settings` real.** Reemplazo del placeholder por una página de configuración completa con 5 secciones, cada una con su propio botón "Guardar / Descartar" que aparece sólo cuando el draft difiere del servidor (atomic per-section saves):
  - **Identidad** — name + brand + model (PATCH `/superadmin/terminals/:id`).
  - **Estado y operación** — Combobox con los 5 status (ACTIVE / INACTIVE / MAINTENANCE / PENDING_ACTIVATION / RETIRED). Cuando se elige `RETIRED` aparece banner danger explicando que es irreversible.
  - **Merchant accounts** — multi-checkbox con todos los merchant accounts activos del backend. Mostrando provider + alias + externalMerchantId en cada uno.
  - **Módulos del home screen** — 9 toggles para los botones que ve el staff al entrar al TPV (cobro rápido, gestión de órdenes, checkout, pagos, reportes, metas, mensajes, trainings, soporte). Cada toggle es una row con icono Eye/EyeOff que indica visible/oculto. PUT `/tpv/:id/settings`.
  - **Pagos y captura** — 4 toggles para `enableCashPayments`, `enableCardPayments`, `enableBarcodeScanner`, `enableSerializedInventory`. Mismo endpoint.

  El componente reutiliza `<Section>` (header con title + subtitle + dirty actions) y `<SettingsBooleanSection>` (lógica de draft / diff / save para grupos de toggles). El archivo placeholder `TerminalResourcePlaceholder.tsx` se eliminó completamente del repo.

- **Modo de activación en `/terminals/new`: 3-option radio.** Reemplazo del checkbox binario `generateActivationCode` por un picker tipo "billing plan" con 3 opciones:
  - **Generar código para técnico** (recomendado) — flujo original con código 6-char + success card con copy button.
  - **Activar ahora — sin código** — registra + dispara `remote-activate` inmediatamente. Útil cuando el hardware ya está físicamente prendido y conectado. La terminal queda ACTIVE sin pasar por el flujo de código. Si remote-activate falla, el toast lo aclara y la terminal sigue creada en PENDING_ACTIVATION para reintento desde el drawer.
  - **Pendiente — registrar sin activar** — sólo registra en PENDING_ACTIVATION, sin código, sin activación. Para roll-outs en lote donde primero se da de alta todo y se activa en bloque después.

  El botón de submit cambia label según el modo: "Crear y generar código" / "Crear y activar" / "Crear terminal".

- **Alta de terminal real en `/terminals/new`.** Reemplazo del placeholder por un form completo. Secciones:
  - **Esencial** (siempre visible): venue (Combobox de todos los venues con search por nombre/slug/org · pre-seleccionado e inmutable si el operador llegó desde el icono de Setup en `/venues` con `?venueId=X`), nombre interno, tipo (Combobox de 5 opciones: TPV Android · TPV iOS · Impresora ticket · Impresora cocina · KDS), serial number (required por el zod del backend — el hint explica cómo poner un placeholder cuando aún no se tiene serial físico).
  - **Hardware** (collapsed): brand (Combobox con `allowCustomValue` y catálogo común: PAX, NEXGO, Verifone, Ingenico, Star Micronics, Epson, Apple) + modelo (input libre).
  - **Merchant accounts** (collapsed): lista de merchant accounts activos del backend (`GET /superadmin/onboarding/merchant-accounts`), checkbox por cada uno, muestra `displayName · provider · alias · externalMerchantId`. Si no se asigna ninguno, la terminal usa el merchant primario del venue.
  - **Activación** (siempre visible): checkbox "Generar código de activación" pre-marcado por default. Cuando está activo, el container del checkbox se pinta accent para enfatizar que es la opción default.
  - **Success card post-create con código de activación**: si se pidió código, en vez de navegar directo a `/terminals`, se muestra una pantalla focused con el código 6-char en monospace 44px, expiración formateada, botón copiar, y CTA "Ir a la lista de terminals". Esto fuerza al operador a copiar el código antes de moverse — la pantalla no es un toast efímero, es un milestone.
  - Pre-fill desde el icono de Setup en `/venues`: si llega `?venueId=X`, el dropdown queda fijo y el back-link va al venue (no a `/terminals`).

### Fixed

- **E2E `login.spec.ts › shows validation when email is invalid` fallaba en CI.** El test escribía `no-es-email` en un `<input type="email">` y esperaba ver el mensaje "Email inválido" de zod, pero el browser cortaba el submit con su validación nativa antes que react-hook-form/zod pudieran correr — el aviso nativo del browser tomaba precedencia y el mensaje tipado nunca renderizaba. Fix: agregado `noValidate` al `<form>` del LoginPage para que zod sea la única autoridad. Confirmado local: 2/2 tests pasan en 3.2s. El UX para humanos no cambia (zod produce el mismo mensaje); cambia el behavior con browsers que aplican validación nativa estricta (Chromium Headless en CI).
- **CI `npm run test:e2e` rompía con `Timed out waiting 60000ms from config.webServer`.** Causa: cuando cambiamos el puerto de Vite a `5177` en `vite.config.ts` (para coexistir con otros dev servers locales del operador), `playwright.config.ts` siguió esperando el webServer en `localhost:5173` — el dev arrancaba en 5177, Playwright lo buscaba en 5173, timeout exacto a los 60s. Fix: alineado el `webServer.url` y el `baseURL` a `http://localhost:5177` mediante una constante `DEV_SERVER_URL` (con comment apuntando a `vite.config.ts` como single source of truth para evitar que vuelva a divergir). Timeout también subido de 60s → 120s para tolerar cold-starts de CI con `npm ci` reciente. README actualizado al puerto real (`http://localhost:5177`).
- **El detalle del merchant mostraba "Terminales (0)" + chip de readiness rojo para merchants ruteados de forma normal.** El conteo contaba sólo asignaciones explícitas (`Terminal.assignedMerchantIds`), pero el routing real del TPV también incluye **herencia por slot**: una terminal con `assignedMerchantIds` vacío sirve a todos los merchants slotteados de su venue. Ahora el conteo (detalle + chip + la lista en `/merchants`) es **inheritance-aware** = terminales explícitas ∪ heredadas por slot del venue. Fix en `avoqado-server` (`merchantAccount.service.ts`, helper `resolveEffectiveTerminals` + test, aditivo, deploy-first); el frontend ya leía `terminals`/`_count.terminals`. Empty-state actualizado ("Ninguna terminal lo procesa todavía…").

### Changed

- **README en sync con la estructura real + nueva sección «Páginas».** La sección «Estructura» pasó de un árbol pre-feature-based (`components/` · `pages/` · `services/`, ya inexistentes) al layout real (`app/` ← `features/` ← `shared/`). Se agregó una tabla «Páginas» que lista las rutas top-level con su feature, incluidas las de Merchant Accounts (`/merchants`, `/merchants/:id`, `/merchants/new`, `/merchants/new-angelpay`, `/venues/:id/merchant`). También se corrigió la fila de fuentes (listaba dos pero decía «tres»: Inter contenido · Geist shell · Geist Mono datos).
- **Icon-buttons centralizados en `IconButton` + estado "on" ya no es blanco.** Nuevo primitive `src/shared/ui/IconButton.tsx` (+ `iconButtonVariants()` para `<Link>`) — forma única: cuadrado `rounded-[6px]`, icono tenue que se ilumina elevando la superficie en hover, `size="sm"` (h-7) / `md` (h-8). Migrados los 6 icon-buttons inline (toggles de `TerminalsByVenueList`/`VenuesByOrgList`, acción de fila de `TerminalsPage`, copy de `VenueDetailPage`, acción de `ActivityLogPage`, y el close del `Drawer`) — antes eran `h-6/h-7/h-8 rounded-[4px]` inconsistentes. **`SetupIcons`**: el estado "configurado" (ok) pasó de `bg-[var(--surface-primary)]` (blanco CTA, gritaba) a **superficie elevada** (`bg-[var(--canvas-raised)]` + icono `--ink`) — se lee "lleno/listo" sin blanco; missing = hundido + tenue. Regla nueva en CLAUDE.md: `IconButton` es el único primitive para botones icon-only; el estado activo se pinta elevado, nunca blanco.
- **Semántica de color de badges normalizada — el color codifica juicio, no identidad.** Los **tipos** de terminal (`TPV_ANDROID`, `TPV_IOS`, `KDS`) pasaron de `accent`/`info` a **`muted`**: un tipo es una clasificación, no un estado, así que no debe llevar color (colorearlos era ruido). `MAINTENANCE` pasó de `info` (azul, dato neutro) a **`warn`** (ámbar, estado de atención). `ACTIVE` se queda `success` (verde = saludable). Rúbrica documentada en `.impeccable.md` + `CLAUDE.md`: `success`=saludable · `warn`=atención · `danger`=error · `info`=dato neutro (parsimonia) · `muted`=sin juicio/tipos. (Cambios en `src/features/terminals/types.ts`.)
- **Badges unificados en un solo primitive `<Badge>` (pill sin borde).** Antes convivían dos formas para lo mismo: el componente `Badge` (pill `rounded-full`) y badges cuadrados inline / el utility `tag` (`rounded-[3px]/[4px]` con borde). Se centralizó todo en `Badge` con un prop `size` (`sm` 10px / `md` 11px) — siempre pill, sin borde, tint por tono, acepta icono. Migrados: las 2 micro-badges "Se encolará" (`TerminalActionDrawer`), el badge "core" (`NewVenuePage`), el option-tag condicional (`NewTerminalPage`), los badges de source/json de logs (`SystemLogsPage`) y el indicador "Live" (`AppLayout`). El utility `@utility tag` se eliminó de `index.css`. Regla nueva en CLAUDE.md: `Badge` es el componente único para cualquier pill/etiqueta; prohibido armar badges inline. `.impeccable.md` actualizado.
- **Acento neutro / monocromo: el azul GitHub dejó de ser el color de marca.** El `--accent` pasó de azul `#58a6ff` a **`#e6edf3` (ink/blanco, sin hue)** — nav activo, links, focus ring y brandmark ahora son monocromos ("herramienta, no producto"). El azul `#58a6ff` quedó **reservado sólo para `--info`** (status), así deja de chocar con el acento. Cambio en un solo lugar (`src/app/index.css`: `--accent`, `--accent-hover`, `--accent-faint`, `--accent-line`, `--ring`, dark + light) gracias a la tokenización — el resto de la app siguió. Verificado que ningún `bg-[var(--accent)]` quedó blanco-sobre-blanco (todos van con `text-[var(--canvas)]`, incl. el check del `Checkbox`). `.impeccable.md` + `CLAUDE.md` actualizados.
- **Tipografía espejo del dashboard principal: Urbanist eliminado.** El superadmin ahora replica el sistema de fuentes de `avoqado-web-dashboard`: **Inter** en el contenido (default global `--font-sans` — así llega también a los overlays portaleados a `document.body`: drawer, dialog, popover/Combobox, command palette, toasts), **Geist** en el shell/sidebar (override local `--font-sans: var(--font-geist)` en el `<aside>` del `AppLayout`), y **Geist Mono** para IDs/versiones/numerales. El mecanismo es el del dashboard: cada familia es su propia variable (`--font-geist` / `--font-inter` / `--font-geist-mono`) y se swapea `--font-sans` por subárbol en vez de clase por clase. La utility `font-display`, `eyebrow` y el `body` ahora resuelven a `var(--font-sans)`, así que los 21 archivos que usan `font-display` siguen funcionando sin tocarse y heredan la fuente activa (Inter en contenido, Geist en sidebar). Paquete `@fontsource-variable/urbanist` desinstalado, `@fontsource-variable/inter` agregado. `.impeccable.md` + `CLAUDE.md` actualizados.
- **Tratamiento editorial de mayúsculas espaciadas eliminado + tipos consolidados en utilities.** Se quitó el `uppercase` + `letter-spacing` de todos los labels, section headers, field labels y micro-badges funcionales (28 instancias en 12 archivos) — ahora sentence case, look utilitario en vez de "revista". El utility `eyebrow` se redefinió a sentence case (sin `text-transform` ni `letter-spacing`). Para frenar los px hardcodeados inline, se agregaron dos utilities semánticas en `src/app/index.css`: **`label`** (field labels: 11px / 500 / ink-faint) y **`tag`** (micro-badge con borde: 10px / forma fija, el color queda inline porque es semántico). Se migraron los patrones repetidos (`<dt>` del drawer, headers de `DataTable`/`ExportDialog`/`FilterPill`, badges "Se encolará"/badge accent de `NewVenuePage`) a estas utilities — el tamaño/forma vive en un solo lugar. Se conservan en uppercase sólo los dos wordmarks de marca (`Brandmark`, footer de `CommandPalette`). Casos genuinamente distintos (labels sobre fondo accent, badges con `py` en vez de altura fija, status pill "Live") quedaron inline a propósito.
- **Sistema de CTAs unificado: `<Button>` + `buttonVariants()` helper.** Eliminadas todas las 11 instancias inline de `bg-white text-[var(--canvas)] hover:bg-white/90 ...` que vivían en 8+ archivos (`TerminalsPage`, `VenuesPage`, `NewVenuePage`, `NewTerminalPage`, `*ResourcePlaceholder`, `TerminalActionDrawer`, `FilterPill`, `ErrorFallback`). El componente `<Button>` se usa para `<button>` y el nuevo helper `buttonVariants({ size, variant, className })` se usa cuando el CTA es un `<Link to="...">` de react-router. Tokens semánticos nuevos: `--surface-primary`, `--surface-primary-hover`, `--on-surface-primary` — si el primario un día deja de ser blanco, se cambia el token y todos los CTAs siguen. `buttonVariants` vive en `src/shared/ui/button-variants.ts` (separado de `Button.tsx` por HMR-safety: mezclar exports de funciones y componentes rompe Fast Refresh). Regla reforzada en CLAUDE.md: prohibido escribir `bg-white` literal o clases de botón inline; test de regresión `grep -rn "bg-white" src/` debe devolver solo comentarios.
- **Tipografía display: Bricolage Grotesque → Urbanist Variable.** Geometric sans con weight axis, más limpia que Bricolage (que tiene optical-size axis y un toque editorial que se sentía decorativo en pantallas operativas). Geist se mantiene para body/UI. Urbanist alinea con la estética "Minimal Tech Operations Tool" del `.impeccable.md` — refinada sin firma editorial. Paquete `@fontsource-variable/bricolage-grotesque` desinstalado. Referencias en `.impeccable.md` + `CLAUDE.md` actualizadas.

### Changed

- **Rediseño completo del tema visual.** Paleta migrada de blue-slate/indigo (H=245°/270°) a GitHub Dark (`#0d1117` canvas, `#58a6ff` accent). Todos los botones primarios (component `<Button>` y CTAs inline) ahora son `bg-white text-black`. Secondary button migrado a ghost outline.
- **Tipografía display: Bricolage Grotesque Variable.** Headings, KPIs y títulos ahora usan Bricolage Grotesque en lugar de Geist Variable. Geist se mantiene para body/UI/nav. Tres familias con roles claros: Bricolage (display), Geist (body), JetBrains Mono (code/IDs).
- **Badges rediseñados.** De `rounded-[4px]` boxy con borders visibles a `rounded-full` pill-shaped sin bordes.
- **`.impeccable.md` y `CLAUDE.md` actualizados** para reflejar la dirección: paleta GitHub Dark, botones blancos, badges pill sin bordes.

### Changed

- **Drawer ancho default 480 → 640 px.** Más respiración para grid 2-col en el body. En viewport < 640px sigue siendo full-screen. Override con `className="max-w-[…]"` cuando una página necesite otro tamaño.
- **Todos los `<select>` nativos migrados a `Combobox`.** En `NewVenuePage` los 3 selects existentes (Tipo de venue, Persona fiscal, Organización) ahora usan Combobox. Beneficios: search dentro del dropdown, scroll consistente, categoría como description (ej. "Restaurante / Restaurantes y bares"), búsqueda por términos secundarios (`searchTokens`) — escribir "tienda" matchea todos los retail types. El Persona fiscal pasa por Combobox también aunque sólo tenga 2 opciones — consistencia visual gana sobre minimalismo. Regla reforzada en CLAUDE.md: **NUNCA** uses `<select>` HTML, `<option>` o `<optgroup>` ni armes dropdowns custom con div+button. Combobox cubre todo.

### Added

- **`Combobox` primitive del design system.** Reemplazo del `<select>` nativo cuando hay más de 5 opciones o cuando los values son identifiers (versions, slugs, IDs). Construido sobre `cmdk` (mismo motor que la `CommandPalette`) + Radix Popover. Reglas no-negociables documentadas en CLAUDE.md: trigger visiblemente padre, search siempre visible, scroll del list con `max-h-[260px] overflow-y-auto`, empty state explícito, `allowCustomValue` opcional para casos donde el value puede ser typed (versions, slugs futuros).
- **`INSTALL_VERSION` ahora usa Combobox poblado del backend.** Reemplazo del input free-text por un dropdown con las versiones disponibles de AvoqadoPOS (`GET /dashboard/superadmin/app-updates`). Cada opción muestra `versionName` + `vCode N · environment · updateMode`. Sort por `versionCode` desc (más nuevas arriba). Search soporta tanto por nombre (`1.42.0`) como por code (`156`). Con `allowCustomValue` activado para que el operador pueda escribir una versión no listada — útil para rollbacks puntuales o testing de pre-releases.

### Changed

- **Comandos de terminal ya no se deshabilitan cuando la terminal está offline.** El backend YA encola los comandos (`TpvCommandStatus.QUEUED`) y los despacha cuando la terminal vuelve online. Antes el UI los bloqueaba — el operador no podía pre-programar un `RESTART` para cuando la terminal recobre conectividad. Ahora: (1) los botones son clickeables incluso offline; (2) cada acción muestra un pill discreto `SE ENCOLARÁ` cuando aplica; (3) un banner `info` arriba del drawer explica el comportamiento y referencia el estado `QUEUED` para que el operador entienda dónde ver el comando en el histórico cuando lleguemos a esa sección.

### Added

- **Feature completo de TPVs / Terminals.** Lista en `/terminals` con DataTable + KPI strip asimétrico + filtros pills (Estado multi-select · Tipo multi-select · Conexión single-select: online/offline/sin activar · Agrupar single-select por venue) + agrupado por venue como vista alterna + export CSV con 13 columnas + auto-refresh cada 30s para mantener `lastHeartbeat` actualizado. KPIs derivados client-side: Sin activar / En mantenimiento / Total / Online / Activas offline — el `focus` tile elige por urgencia. Click en cualquier row de la tabla abre **drawer slide-from-right** con todas las acciones de la terminal. Sidebar: entrada "TPVs" enabled.
- **Drawer de acciones de terminal.** Slide-in de la derecha (no modal — sigue el `.impeccable.md`). Header con badges de tipo + status + locked, identidad (name + serial + brand/model). Body con secciones:
  - **Status summary**: dot online/offline en tiempo real, health score 0-100 colorizado, último heartbeat, versión, IP, link a venue.
  - **Activación pendiente** (sólo cuando aplica): botón "Generar código" muestra 6-char monospace + expiración relativa + copy; botón "Activar remotamente" para terminals físicamente presentes que no requieren intervención en sitio.
  - **Acciones rápidas**: Reiniciar (RESTART), Limpiar caché (CLEAR_CACHE), Mantenimiento ON/OFF (toggle MAINTENANCE_MODE/EXIT_MAINTENANCE), Bloquear/Desbloquear (toggle LOCK/UNLOCK). Comandos disabled con tooltip explicativo cuando la terminal está offline.
  - **Versión**: muestra versión instalada + input + botón "Instalar" (INSTALL_VERSION con payload `{ version }`) + botón "Pedir actualización" (REQUEST_UPDATE muestra diálogo al usuario).
  - **Datos y configuración**: Sync de datos (SYNC_DATA), Exportar logs (EXPORT_LOGS), link a `/terminals/:id/settings` (placeholder).
  - **Acciones destructivas**: separadas con border `--danger`, contienen Restablecer de fábrica (FACTORY_RESET) y Apagar (SHUTDOWN). Cada una requiere typed-confirm — el operador escribe el serial number de la terminal para ejecutar.
- **`Drawer` primitive del design system.** Wrapper de `@radix-ui/react-dialog` posicionado slide-from-right en desktop (max-w-[480px]) y full-screen en mobile. Animaciones fade + slide. Header / body / footer sub-componentes. Overlay con backdrop-blur sutil.
- **Placeholders pre-cableados de terminales**: `/terminals/new` (con `?venueId=X` para pre-fill desde el icono de Setup en `/venues`) y `/terminals/:terminalId/settings` (configuración completa). Mismo patrón aditivo que los venue placeholders — la URL queda fija, cuando construyamos el form real se reemplaza el `element` del Route.

### Added

- **5 rutas dedicadas pre-cableadas para configurar recursos del venue.** Los mini-iconos del setup en `/venues` ahora navegan a URLs definitivas — no a `/venues/:id?focus=…`. Pre-cableo de paths futuros:
  - `/venues/:venueId/owner` — asignar / cambiar owner
  - `/venues/:venueId/kyc` — subir docs y disparar revisión
  - `/venues/:venueId/terminals/new` — alta de TPV
  - `/venues/:venueId/merchant` — vincular merchant account
  - `/venues/:venueId/pricing` — comisiones custom

  Todas montan hoy un `<VenueResourcePlaceholder resource="…">` único — una pantalla que lee el `venueId` de los params, carga el venue, y muestra el contexto que el componente real recibirá: nombre del venue, slug, organizationId, descripción de qué se iba a hacer, y CTAs útiles ("Ir al detalle del venue" / "Volver a la lista"). **Cuando se construya la pantalla real para cada recurso, sólo se reemplaza el `element` del Route por el componente verdadero** — la URL queda fija, los iconos siguen funcionando, el contexto del venue sigue llegando por params.

- **`Tooltip` primitive del design system + tooltips en iconos de setup.** Nuevo wrapper de `@radix-ui/react-tooltip` (`src/shared/ui/Tooltip.tsx`) con los tokens OKLCH del repo y un helper `<Tooltip content="…">`. Montado vía `TooltipProvider` en `main.tsx` con `delayDuration={150}` + `skipDelayDuration={300}` — Radix por default usa 700ms que se siente lento para un power user 6h/día. Los iconos de setup en `/venues` ahora muestran al hover un tooltip rich con el nombre del check (uppercase eyebrow) + descripción del estado + hint "Click → abrir el detalle del venue para resolverlo" cuando aplica. El contador compacto `3/5` en vista agrupada enumera qué falta: `"Setup · 3 de 5 · Falta: Terminal, Merchant"`.
- **Columna "Setup" en `/venues` con iconos clickeables.** Nueva columna que muestra el progreso de configuración del venue como 5 mini-íconos compactos (Owner, KYC verificado, Terminal, Merchant account, Pricing). Cada icono cambia de color según el estado: **verde** (configurado), **gris con borde sólido** (falta — clickeable lleva al detail con `?focus=<area>` para que la pantalla destino sepa "vengo del venue X queriendo resolver Y"), **gris con borde punteado** (desconocido — el backend no devolvió el flag). Tooltips explicativos en hover. Ordenable por columna — los venues con setup incompleto pueden flotar arriba al sortear. En vista agrupada por organización aparece como contador compacto "3/5" en cada row.
- **`VenueDetailPage` lee `?focus=…`** y muestra un banner contextual cuando el operador llegó desde un mini-icono. El banner explica qué se esperaba resolver y linkea a la pantalla más cercana (ej. focus=kyc → CTA "Ir a la cola de KYC"). Cuando construyamos pantallas dedicadas (`/terminals/new?venueId=X`, `/merchants/new?venueId=X`), los mini-íconos pueden saltar directo allá y el banner queda obsoleto.

### Changed

- **Backend `getAllVenuesForSuperadmin` extendido (aditivo).** El response ahora incluye `completeness: { hasOwner, hasTerminal, hasMerchantAccount, hasKycDocs, hasPricing, kycVerified }`. Calculado server-side con 3 queries adicionales en paralelo (`terminal.groupBy`, `venuePaymentConfig.findMany`, `venuePricingStructure.groupBy`). El bloque es opcional para que consumidores legacy (avoqado-web-dashboard) lo ignoren sin romperse.
- **Owner del venue: query incluye `OWNER` además de `ADMIN`.** El servicio ahora trae staff con `role: { in: ['OWNER', 'ADMIN'] }` y prefiere `OWNER` al elegir el "owner principal" — `ADMIN` queda como fallback para legacy data (venues creados antes que el rol OWNER existiera asignado al dueño).
- **`/venues/new` — catálogo de tipos rediseñado en 4+ grupos visuales.** El select de tipo usa `<optgroup>` con grupos: **Restaurantes y bares** (Restaurante, Bar, Café, Panadería, Comida rápida, Food truck, Catering, Cocina fantasma), **Tiendas** (Retail, Joyería, Ropa, Electrónica, Farmacia, etc.), **Servicios** (Clínica, Veterinaria, Fitness, Reparaciones, Lavandería, Auto), **Estéticas y spas** (Salón, Spa), **Hospedaje**, **Entretenimiento**, **Otro**. Total: 35+ subtipos cubriendo todo el enum del backend pero presentados de forma escaneable.
- **`/venues/new` — datos fiscales en sub-sección colapsada.** Persona Física/Moral + RFC + razón social ya no aparecen siempre. Pasaron a una sub-sección "Datos fiscales" dentro de Identidad, colapsada por default. Para demos rápidos no hace falta abrirla; el backend tampoco exige Persona Física + RFC para crear. Si el operador la abre y marca PERSONA_MORAL, ahí sí los pide (lo exige el zod schema).
- **`/venues/new` — owner se crea con rol `OWNER`, no `ADMIN`.** Era un bug semántico: el dueño legal del venue debe tener rol OWNER (cap superior del venue). `ADMIN` se reserva para Staff con permisos plenos pero sin ownership.
- **`/venues/new` expandido con dirección/contacto y features.** Dos secciones nuevas (collapsibles): **Dirección y contacto del venue** (address, city, state, zipCode, phone, email — los campos que compliance exige antes de procesar pagos) y **Features activos** (catálogo del backend agrupado por categoría, los `isCore: true` se pre-seleccionan al cargar, cada uno muestra nombre + descripción + precio mensual cuando aplica). El payload del wizard ahora envía `venue.address/city/state/zipCode/phone/email` + `features: string[]`. Validación client-side respeta los mínimos del zod schema del backend (address.min(5), city.min(2), zipCode.min(4), etc.) pero sólo aplica cuando el campo está lleno — siguen siendo opcionales para crear. Nueva función `fetchFeatures()` apunta a `GET /dashboard/superadmin/features` (legacy namespace, envoltorio `{success, data, message}`).
- **`KpiStrip` con flex layout dinámico.** Antes el `grid-cols-[2fr_1fr_1fr_1fr_1fr]` fijo dejaba slots vacíos grises cuando `rest.length < 4` (típicamente sólo hay 2-3 tiles). Refactor a `flex flex-col sm:flex-row` con `flex-[2]` en focus y `flex-1` en cada tile secundario — el strip se adapta sin huecos visuales, mantiene la jerarquía.

### Added

- **`/venues/new` — página dedicada para crear venue.** Patrón industrial moderno (Stripe Atlas / Mercury / Linear): UN solo screen con secciones progresivamente reveladas, NO wizard de N pasos. Defaults razonables para todo lo opcional. Tres zonas: **Identidad** (visible, org existente/nueva + venue básicos + persona fiscal + RFC), **Owner inicial** (collapsed por default, opcional), **Operaciones administrativas** (collapsed con icono warn, contiene el checkbox "Pre-aprobar KYC y activar"). Después de crear, navega a `/venues/:id` con toast de confirmación. La aprobación inline de KYC dispara un segundo POST a `/dashboard/superadmin/venues/:id/approve` — el backend registra ambas acciones en ActivityLog automáticamente. Consume `POST /api/v1/superadmin/onboarding/venue` (wizard endpoint que YA existía). Botón "+ Nuevo venue" en `/venues` vuelve como `Link` real al header.

### Changed

- **`/venues` — fixes del audit de diseño director-mode.** (1) Eliminado el botón disabled "+ Nuevo venue" con tooltip "Próximamente" — era placeholder energy que hacía sentir prototype la página entera. Volverá cuando el wizard exista. (2) Eliminado el disclaimer apologético del footer ("Algunos campos del backend están pendientes...") — la editorial operations terminal no se disculpa por su backend. (3) "Borrar filtros" ya no usa `--danger` color — la semántica destructiva se reserva para acciones que pierden datos (suspender, eliminar, rechazar); limpiar filtros es reversible y va en `--ink-muted` con `hover:--ink`. (4) **KPI strip rediseñado con jerarquía asimétrica**: el grid identical-card de 5 cells iguales se reemplazó por `[2fr_1fr_1fr_1fr_1fr]` donde el primer tile es el `focus` (KPI accionable elegido por urgencia: KYC en cola > Onboarding > Total) con 32px display + footnote + border-l accent cuando es accionable. Los tiles secundarios son 22px sin footnote — son referencias, no historias. `ADMIN_SUSPENDED` se separó de `SUSPENDED` voluntario porque son operacionalmente distintos: el admin-suspended cuando hay alguno aparece con `warn` background como tile accionable. La función `buildKpis()` ahora retorna `{ focus, rest }` en vez de array uniforme.

### Added

- **`/venues` — vista alterna "Agrupar por organización".** Nuevo pill "Agrupar" en el toolbar (single-select: Sin agrupar / Por organización). En modo agrupado, los venues se rinden por org en secciones editoriales con header "PLAYTELECOM · 5 venues · $0 procesados · 0 pagos" (totales agregados client-side). Cada sección es colapsable con chevron. Las orgs se ordenan por volumen del mes desc (las que están moviendo más, arriba), empate → más venues primero, empate → alfabético. Los filtros (Estado, KYC, Vista) siguen aplicando — si los filtros vacían una org, su sección no se renderiza. Search global y export CSV solo viven en vista plana — el toolbar lo aclara en la descripción del pill. `groupBy` se trata como preferencia de VISTA (no filtro): "Borrar filtros" no la resetea. Nuevo componente `VenuesByOrgList` en `src/features/venues/`.

### Fixed

- **`/venues` — auditoría visual.** (1) El `<Badge>` ahora trae `whitespace-nowrap` — antes "KYC · VERIFICADO" envolvía el segundo word a una nueva línea dentro del pill cuando la columna estaba apretada. (2) El KYC pill se muestra **sólo cuando el estado NO es VERIFIED** — antes aparecía en todas las rows como decoración. Ahora sólo se renderiza si el operador necesita actuar (PENDING_REVIEW, IN_REVIEW, REJECTED, NOT_SUBMITTED, o sin KYC); rows verificadas dejan respirar el cell. (3) Nuevo helper `inspectOwner(owner)` detecta dos tipos de "owner missing": el fallback `Unknown Owner + unknown@email.com` que devuelve el backend cuando no hay Staff ADMIN, y los emails sintéticos `*@internal.avoqado.io` que el backend genera para venues sin ownership humano. Ambos casos se renderizan en italic muted como "Sin owner" con sub-texto explicativo ("Falta Staff ADMIN" o "Cuenta de sistema") en lugar de leakear los placeholders al UI. El CSV export también limpia esos campos para que no se peguen en correos por accidente. (4) Headers acortados — "Volumen mes" → "Volumen", "Creado (CST)" → "Creado" (el TZ ya está en el subtítulo de la página). Eliminadas las wrappeadas a 2 líneas en los headers.

### Changed

- **Sistema de filtros migrado a Stripe-style filter pills.** Reemplazo del viejo `MultiSelectPills` (chips inline en una sola línea horizontal larga) por el nuevo `<FilterPill>` con popover. Cada filtro es un pill chico — inactivo con `+ Etiqueta` (borde punteado, muted); activo con `[×] Etiqueta | Valor ▾` (fondo invertido, X limpia, click abre popover). El popover trae el contenido específico: multi-select (`<MultiSelectFilterContent>` con search opcional, master "Seleccionar todo" indeterminate, lista de checkboxes, footer Apply/Limpiar) o single-select (`<SingleSelectFilterContent>` con radio buttons y aplicación inmediata). El cambio multi-select es batched — el operador edita varios valores y aplica una sola vez, evitando que la tabla salte entre clicks. Aplicado en `/venues`, `/system-logs` y `/activity-log` — los tres comparten ahora el mismo lenguaje visual de filtrado. El `<Checkbox>` del design system aprendió a renderizar `−` cuando el estado es `indeterminate`. Nuevo primitive `<Popover>` (wrapper de `@radix-ui/react-popover`). Ubicación: `src/shared/filters/`.
- **`/venues` — toolbar más compacto.** El checkbox "Incluir demos" se promovió a `<FilterPill>` "Vista" con dos opciones (Solo producción / Producción + demos). Aparece como pill inactivo por default; cuando lo cambias, muestra `Vista | Incluye demos ▾`. Botón "Borrar filtros" sólo se renderiza cuando hay filtros activos.

### Removed

- **`MultiSelectPills.tsx` eliminado.** Reemplazado por el patrón nuevo `FilterPill` + content. No hay shim de compatibilidad — todas las páginas migraron en este mismo commit.

### Added

- **Páginas `/venues` y `/venues/:venueId` — el catálogo completo de la flota Avoqado.** La lista usa el `DataTable` estándar: search global (nombre / slug / organización), filtros multi-select de Estado (8 valores: ACTIVE, ONBOARDING, PENDING_ACTIVATION, SUSPENDED, ADMIN_SUSPENDED, CLOSED, TRIAL, LIVE_DEMO) y KYC (NOT_SUBMITTED, PENDING_REVIEW, IN_REVIEW, VERIFIED, REJECTED, Sin KYC), checkbox "Incluir demos" para alternar la inclusión de TRIAL + LIVE_DEMO, sort por columna, paginación de 25, export CSV con 14 columnas (con selector de cuáles incluir). Encima de la tabla hay un KPI strip de 5 métricas (Producción, Activos, En onboarding, KYC en cola, Suspendidos) que se calcula client-side. La detalle muestra header con badges de status + KYC + flags operacionales (Recibiendo pagos / Sin pagos este mes / Demo ephemeral), grilla 2-cols con Identidad + Owner + Suspensión (cuando aplica) a la izquierda y Métricas del mes en curso + Cronología a la derecha. Quick actions ("Cambiar comisión" / "Suspender / Reactivar") están en el header pero quedan `disabled` hasta iteración 2 — esta entrega es read-only sobre los endpoints `GET /api/v1/dashboard/superadmin/venues` y `GET /api/v1/dashboard/superadmin/venues/:venueId` que el dashboard legacy ya consume. El hook `useVenueDetail` usa `placeholderData` para renderizar instantáneo desde el cache de la lista cuando el operador llega desde el row click.
- **Sidebar: entrada "Venues" activada.** En `Catálogo` el item ya no está `disabled` — abre `/venues`.
- **Filtro por origen del request en `/system-logs`.** Nueva fila de pills "Origen" en el toolbar permite filtrar logs por el cliente que originó el request: **Dashboard**, **TPV**, **Superadmin**, **POS móvil**, **Consumer**, **Webhooks**, **SDK**, **POS-Sync**, **Salud**, **Otros**. La detección es 100% client-side parseando el path del mensaje (basado en el mapa de `/api/v1/*` montado en `avoqado-server/src/routes/index.ts`). Cada fila ahora muestra un badge con el origen detectado (`TPV`, `DASHBOARD`, etc.) antes del summary. Cuando hay sources seleccionados, los logs sin path detectable (app errors, build, deploy sin URL) caen del view — el filtro está pensado para enfocarse en tráfico de un cliente específico. Cubierto por 26 casos en `types.test.ts`.
- **Toggle de pausa en `/system-logs`.** Botón "Pausar / Reanudar" en el header detiene el auto-refresh sin cerrar la página — útil para leer un log específico sin que la tabla cambie debajo del cursor. El indicador del estado (`En vivo` / `Actualizando…` / `Pausado`) y el subtítulo (`auto-refresh cada 10s` / `auto-refresh pausado`) reflejan el modo. El botón "Refrescar" sigue funcionando en pausa para disparar un fetch manual puntual. El hook `useSystemLogs` ahora acepta `refetchEverySeconds: false` para desactivar el polling sin perder la query cacheada.
- **Página `/system-logs` con stream en vivo de Render.** El superadmin ya no tiene que entrar al Render Dashboard para ver errores — los logs (stdout / stderr / build / request) se muestran directo en la consola. Se construyó como proxy server-side (`GET /api/v1/superadmin/system-logs`) que llama a la Render API con `RENDER_API_KEY` server-side; el browser nunca ve la key. Auto-refresh cada 10s cuando la pestaña tiene foco. Filtros por nivel (info/warning/error) y tipo (app/request/build/deploy). Búsqueda por mensaje. Cada fila expande para ver el log completo. Cuando las env vars no están configuradas la UI muestra un empty state amable explicando qué falta.
- **Patrón decidido**: usamos Render API en vez de tabla DB. Razones: (1) cero preocupación por storage en la DB (Render lo retiene), (2) captura más cosas (build, deploy, crashes pre-Express, jobs), (3) menos código que mantener. Trade-off: retención de ~7 días en free tier, ~30 días en paid. Si en el futuro necesitamos auditoría histórica más larga o filtros por endpoint/staff/correlationId estructurados, agregamos una tabla `SystemLog` complementaria.

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
