# Modelo de pricing de merchants (cómo Avoqado le cobra a los venues)

> Documento de referencia del **modelo de negocio** detrás de la economía de un merchant
> account. No es cómo está el código hoy, sino **cómo el founder cobra** — para que
> cualquiera (humano o agente) lo entienda sin tener que re-preguntarlo.

## Dos formas de cobrarle a un venue

El founder usa **una de dos**, según el caso — ambas comparten el **reparto 50/50 con el procesador**:

1. **Solo revenue share** (sin extra) — le cobra al venue un precio (que **puede ser menor que su
   costo**, p. ej. AMEX 2.6 % cuando le cuesta 3 %), y el **margen `precio − costo` se reparte 50/50**
   con el procesador. En las tarjetas caras **pierde** (compartido 50/50); en las baratas gana.
2. **Con precio extra (agregador)** — además del precio base, le **monta un markup extra** encima, y
   decide si ese extra lo reparte o se lo queda 100 %.

En el **Pricing Wizard** ambas son el modo **"Vía agregador"**: la #1 es con **markup = 0**, la #2
con markup > 0. (El modo "Costo + comisión" es otro caso más simple, sin precio base separado.)

## El modelo detallado (forma 2 — dos tramos)

Hay **tres precios** por tarjeta, y **dos márgenes** que se reparten distinto:

```
COSTO procesador  ──tramo 1 (50/50)──▶  PRECIO BASE al venue  ──tramo 2 (100% Avoqado)──▶  VENUE PAGA
   (fijo)                                  (iguala competencia)        (el markup / "3.5%")
```

### 1. Costo del procesador
Las tasas fijas que el procesador de pagos le cobra a Avoqado. Variable por tarjeta y por venue;
AMEX e internacional suelen ser los más caros. Ej. (cuenta Goia): débito 1.68 % · crédito 2.05 % ·
amex 3 % · internacional 3.3 % (**+ IVA**).

### 2. Precio base al venue (`aggregatorPrice`)
La tarifa base que Avoqado le ofrece al venue, típicamente **igualando o mejorando a la
competencia** (p. ej. Clip). **Puede ser MENOR que el costo del procesador.** Ej. AMEX: el costo es
3 % pero se le da `2.6 % + IVA` — Avoqado "pierde" en este tramo, y no importa (ver §4).

### 3. Tramo 1 — procesador → precio base: **reparto 50/50**
El margen `precio base − costo` se parte **mitad y mitad con el procesador**. Si es **negativo**
(precio base < costo), **la pérdida también se comparte 50/50**: el procesador absorbe la mitad.
Este reparto es **fijo, no negociable**.

### 4. Tramo 2 — precio base → venue: **el markup, 100% Avoqado**
El extra que Avoqado le monta encima del precio base (el "3.5 %"). Es **íntegro de Avoqado**. Con
esto Avoqado **se recupera** de la posible pérdida del tramo 1. El **IVA del markup es configurable
por comercio**: unos lo pagan **sin IVA** (íntegro), otros **con IVA**.

## Fórmulas

```
venue paga           = precio base + markup
ganancia Avoqado     = 0.5 · (precio base − costo)   +   1.0 · markup
                        └─ tramo 1 (puede ser negativo) ─┘   └─ tramo 2 ─┘
```

## Ejemplo trabajado — AMEX (cuenta Goia)

| Concepto | % |
|---|--:|
| Costo procesador (3 % + IVA) | 3.48 % |
| Precio base al venue (2.6 % + IVA) | 3.02 % |
| Tramo 1 = precio base − costo | −0.46 % |
| — Avoqado (50 %) | **−0.23 %** |
| Markup (3.5 %, sin IVA, 100 %) | **+3.50 %** |
| **Venue paga** = 3.02 % + 3.5 % | **≈ 6.52 %** |
| **Ganancia Avoqado** = −0.23 % + 3.5 % | **≈ 3.27 %** |

Aunque el precio base (2.6 %) sea más barato que el costo (3 %), Avoqado no se preocupa: el
procesador comparte esa pérdida y el markup del tramo 2 la recupera.

## Frases del founder que identifican este modelo

- "me recupero con el 3.5 %"
- "el 3.5 % es íntegro para mí" / "no lleva IVA (pero en otros comercios sí)"
- "revenue share 50/50 con el proveedor"
- "le doy precio X aunque mi costo sea mayor"
- "lo extra que yo cobre decido si es repartido o 100 % Avoqado"

Si escuchas esto, **es este modelo de dos tramos — NO cost-plus simple** (cost-plus asume un solo
markup 100 % tuyo sobre el costo, sin el precio base ni el reparto 50/50).

## Mapeo a la feature (modo "Vía agregador")

| Concepto de negocio | Campo en la feature |
|---|---|
| Costo del procesador | `ProviderCostStructure` (débito/crédito/amex/intl) |
| Precio base al venue | `MerchantRevenueShare.aggregatorPrice` |
| Reparto tramo 1 (50 %) | `MerchantRevenueShare.avoqadoShareOfProviderMargin` = 0.5 |
| Venue paga (precio base + markup) | `VenuePricingStructure` (por venue/slot) |
| Reparto tramo 2 (100 %) | `MerchantRevenueShare.avoqadoShareOfAggregatorMargin` = 1.0 |

## Cómo lo captura el Pricing Wizard (implementado 2026-07-19)

El "Asistente de pricing" (`PricingWizardDrawer`), en modo **"Vía agregador"**, pide exactamente los
datos del modelo y **calcula solo el pricing final** (no lo tecleas a mano):

1. **Precio base al venue** (4 tasas) + ¿ya incluye IVA?
2. **Del margen `costo → precio base`, ¿qué % es tuyo?** (tramo 1 — típico 50; el resto es del procesador)
3. **Tu markup encima** (un %) + **¿le sumas IVA?** (por comercio: sin IVA = íntegro)
4. **De tu markup, ¿qué % es tuyo?** (tramo 2 — típico 100)

Pricing final del venue = `precio base efectivo + markup efectivo`. En código: `aggMarkup` /
`aggMarkupIncludesTax` en `pricing-wizard.ts`.
