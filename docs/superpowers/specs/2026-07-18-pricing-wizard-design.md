# Asistente de pricing (Pricing Wizard) — Diseño

- **Fecha:** 2026-07-18
- **Estado:** Diseño aprobado (brainstorming); pendiente plan de implementación
- **Feature:** avoqado-superadmin · `src/features/merchants`
- **Origen:** sesión de brainstorming con el founder

## Problema

Configurar la economía de un merchant hoy exige un modelo mental que no es obvio:

- **Costo del proveedor** vs **pricing del venue** viven en dos drawers distintos y en dos niveles (merchant vs venue).
- Tasas **base vs efectivas** (el checkbox de IVA) cambian el margen sin que sea evidente.
- El **reparto del margen** (revenue share) parte la ganancia y no se refleja en el preview del drawer de pricing (muestra el pool bruto).
- En **cost-plus** hay que hacer a mano la suma "costo + comisión" por tarjeta, y decidir si la comisión es total-a-repartir o neta.

En una sesión real de configuración esto produjo confusión repetida: flat vs cost-plus, IVA sí/no, 50 % vs 100 %, markup total vs neto, y perder en internacional sin darse cuenta.

## Objetivo

Un asistente guiado que pregunta en español plano **cómo le cobras al venue**, calcula todos los números (costo efectivo, pricing por tarjeta, margen neto real) y **prellena** los inputs de los drawers existentes para que el operador solo confirme con Guardar. Cero matemática mental.

## Alcance

**Incluye:**

- Los 3 modelos de cobro: **flat**, **cost-plus**, **vía agregador**.
- Prellenado de punta a punta: costo + reparto (nivel merchant) + pricing del venue elegido.
- Front-only en avoqado-superadmin. Reutiliza mutations existentes (`saveCost`, `saveRevenueShare`, `saveVenuePricing`) y `computeMerchantEconomics`.

**No incluye:**

- Cambios de backend (schema, endpoints, migraciones).
- Modo pricing "dinámico" que se auto-recalcule cuando cambia el costo (posible v2).
- Reescritura de snapshots de pago (esto solo escribe config a futuro).
- Tier gating (herramienta interna de ops, no capability de venue).

## Decisiones (del brainstorming)

| Tema | Decisión |
|---|---|
| Peso | Ligero, front-only |
| Repo | avoqado-superadmin |
| Modelos | flat + cost-plus + agregador |
| Prellena | costo + reparto + pricing del venue |
| UI | Drawer stepper de 3 pasos |
| Botón final | prellena y abre los drawers para confirmar |

## UI — Drawer stepper (`PricingWizardDrawer.tsx`)

Lanzado desde un botón **"Asistente de pricing"** en `MerchantDetailPage`, junto a "Editar economía".

### Paso 1 · Tu costo

"¿Cuánto te cobra tu procesador?" → `CardRatesInput` (4 tasas) + checkbox "¿ya incluyen IVA?". Precargado si el merchant ya tiene `ProviderCostStructure`.

### Paso 2 · Cómo le cobras al venue

Pregunta raíz: "¿Cómo le cobras al venue?" → **Tasa pareja** · **Costo + comisión** · **Vía agregador**.

**Rama flat:**

- "¿Qué % le cobras al venue?" (una tasa) + "¿ya incluye IVA?"
- "¿Repartes tu ganancia con un socio?" No → 100 % tuyo · Sí → "¿qué % es tuyo?"

**Rama cost-plus:**

- "¿De cuánto es tu comisión?" (un número) + "¿esa comisión lleva IVA?"
- "¿Repartes con un socio?" No → 100 % · Sí → "¿qué % es tuyo?"
- Solo si hay socio: "Con reparto X/Y y comisión Z %: ¿te quedas Z×share % (repartes la comisión) o Z % limpio (y al venue le agrego Z/share %)?"

**Rama agregador:**

- "¿Cuánto le cobras al agregador?" (4 tasas) + "¿incluye IVA?" → precio al agregador (nivel 1)
- "Del margen entre tu costo y ese precio, ¿qué % es tuyo?" → share tramo proveedor→agregador
- "¿Cuánto le cobra el agregador al venue?" (4 tasas o flat) + "¿incluye IVA?" → pricing del venue (nivel 2)
- "Del margen entre el precio al agregador y lo que paga el venue, ¿qué % es tuyo?" → share tramo agregador→venue

### Paso 3 · Resumen + prellenar

- Tabla por tarjeta: costo efectivo · (precio al agregador, si aplica) · pricing del venue · **tu margen neto real** (split aplicado; en agregador, suma de ambos tramos).
- Aviso ámbar si alguna tarjeta sale con margen negativo.
- Selector de venue destino (venues asignados al merchant).
- Botón **"Prellenar y revisar"** → prellena y abre `EditEconomicsDrawer` (costo + reparto) y `EditVenuePricingDrawer` (pricing del venue elegido); el operador da Guardar en cada uno.

## Lógica de traducción (`pricing-wizard.ts`, puro/testeable)

Convierte el estado del wizard → 3 payloads crudos. `iva` = taxRate (default 0.16). `eff(r, incTax) = incTax ? r : r*(1+iva)`. `share` en 0..1.

**Flat:**

- pricing_venue (crudo) = flatRate por tarjeta; includesTax = flatIncludesTax.
- revenue share: mode `direct`, shareProvider = share.

**Cost-plus:**

- markup_eff = eff(markup, markupIncludesTax)
- markup_total_eff = markupIsNet ? markup_eff / share : markup_eff
- pricing_venue (crudo, efectivo) = eff(cost[card], costIncludesTax) + markup_total_eff; includesTax = true.
- revenue share: mode `direct`, shareProvider = share.

**Agregador:**

- revenue share: mode `aggregator`, aggregatorPrice = aggPrice (crudo), aggregatorPriceIncludesTax = aggIncludesTax, shareProvider = share1, shareAgg = share2.
- pricing_venue (crudo) = venuePricing; includesTax = venueIncludesTax.

En los 3: costo → `{ rates: cost, includesTax: costIncludesTax }` → `saveCost`.

El preview del Paso 3 usa `computeMerchantEconomics` con los valores efectivos (ya aplica el split).

### Casos ancla (para los tests)

- **Cost-plus**, costo `1.68/2.05/3/3.3` (+IVA), comisión 3.5 % **total** repartida 50/50 → pricing venue **5.45/5.88/6.98/7.33**; pool = 3.5 % parejo → neto Avoqado **1.75 % parejo** ($1.75 por $100 en toda tarjeta). El neto es parejo porque el markup es constante.
- Mismo caso, comisión 3.5 % **"limpia"** (isNet) → al venue se le agrega 7 % → pricing **8.95/9.38/10.48/10.83**; neto Avoqado **3.5 % parejo** ($3.50 por $100 = la comisión limpia).
- **Flat** 3.5 % (con IVA) sobre ese costo → pool por tarjeta 1.55/1.12/0.02/**−0.33** (varía porque el pricing es constante y el costo no); con split 50/50 neto **0.78/0.56/0.01/−0.16** → internacional negativo dispara el aviso ámbar.

## Data flow

Wizard (estado local) → `pricing-wizard.ts` (traducción pura) → `onPrefill(result)` → `MerchantDetailPage` abre `EditEconomicsDrawer` + `EditVenuePricingDrawer` con estado inicial = result → operador Guarda → mutations existentes → invalida queries (`MERCHANTS_QUERY_KEY`).

**Ajuste requerido:** `EditEconomicsDrawer` y `EditVenuePricingDrawer` aceptan un prop opcional de "valores iniciales" para arrancar con lo que calculó el asistente (hoy inicializan desde lo guardado / un fetch). Sin ese ajuste, el fallback sería aplicar directo con las mutations.

## Error handling

- Validación: tasas numéricas ≥ 0, share 0–100, venue seleccionado antes de prellenar.
- Aviso no bloqueante si margen neto < 0 en alguna tarjeta.
- Errores de mutation → `inspectApiError` + `toast.error` (patrón del repo).

## Testing

- `pricing-wizard.test.ts` (unit): los 3 modos × (con/sin IVA) × (con/sin split) × (cost-plus total/neto), con los casos ancla de arriba.
- `PricingWizardDrawer.test.tsx` (component + MSW): recorrido de los 3 pasos, ramificación por modelo, que `onPrefill` emita los payloads correctos.

## Archivos

- **Nuevos:** `PricingWizardDrawer.tsx`, `pricing-wizard.ts`, `pricing-wizard.test.ts`, `PricingWizardDrawer.test.tsx`.
- **Tocados:** `MerchantDetailPage.tsx` (botón lanzador), `EditEconomicsDrawer.tsx` + `EditVenuePricingDrawer.tsx` (prop de valores iniciales), `CHANGELOG.md`, `README.md`.

## No toca

Backend, MCP, schema, snapshots de pago, tiers. Solo UI + lógica pura sobre endpoints existentes.

## Riesgos / notas

- El modo agregador es intrínsecamente más complejo; el valor del asistente ahí es traducir 3 niveles de precio + 2 tramos a lenguaje plano y mostrar el neto combinado.
- Prellenar (vs guardar directo) exige el pequeño ajuste a los 2 drawers; documentar el fallback.
- CHANGELOG.md + README.md se actualizan en el mismo PR (nueva acción top-level en el detalle del merchant).
- Diseño visual del wizard: aplicar `impeccable:frontend-design` en implementación y `impeccable:audit` antes de push (regla del repo).
