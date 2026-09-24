/**
 * Campañas de lanzamiento — anuncio → oferta de plan con cupón de Stripe.
 *
 * Diseño: `docs/superpowers/specs/2026-09-17-lanzamiento-campanas-ligeras-y-onboarding-corto-design.md`
 * (workspace), §2 modelo de datos y §3.4 contrato del superadmin.
 * Backend: `/api/v1/superadmin/launch-campaigns/*` en avoqado-server.
 *
 * 🔴 TODO el dinero de este feature viaja en CENTAVOS enteros CON IVA incluido.
 * Nunca hay pesos con decimales en la red: los decimales existen sólo en el
 * input que teclea el operador, y `money.ts` los convierte en la frontera.
 */

export type LaunchCampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED'

export type LaunchCampaignVertical =
  | 'ALL'
  | 'FOOD_SERVICE'
  | 'RETAIL'
  | 'SERVICES'
  | 'HOSPITALITY'
  | 'ENTERTAINMENT'

export type LaunchCampaignChannel = 'GOOGLE_ADS' | 'META' | 'OPENAI_ADS' | 'MULTI' | 'OTHER'

export type LaunchCampaignInterval = 'MONTHLY'

/** Sólo PRO y PREMIUM tienen precio de lista en Stripe; el CHECK de la base lo fija. */
export type LaunchCampaignPlanTier = 'PRO' | 'PREMIUM'

export type LaunchCampaignRedemptionStatus = 'RESERVED' | 'APPLIED' | 'RELEASED'

/** El orden de los motivos lo decide el servidor (`launchOfferAvailability`). */
export type LaunchOfferUnavailableReason =
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'PAUSED'
  | 'ENDED'
  | 'SOLD_OUT'
  | 'NOT_PUBLISHED'

export type LaunchCampaignAvailability =
  | { available: true }
  | { available: false; reason: LaunchOfferUnavailableReason }

/** La ficha, tal como la devuelve `GET /` y `GET /:id`. Espejo de `LaunchCampaign` (§2.1). */
export interface LaunchCampaignRow {
  id: string
  /** Identificador canónico que VIAJA (formularios, MCP, atribución). Inmutable. */
  code: string
  name: string
  /** Segmento de la landing (/oferta/<landingSlug>). Inmutable tras la 1ª activación. */
  landingSlug: string
  vertical: LaunchCampaignVertical
  channel: LaunchCampaignChannel | null
  /**
   * La VITRINA del giro: la campaña que enseña la página de un giro sin slug en su URL (hoy
   * avoqado.io/restaurants ⇒ FOOD_SERVICE). Exclusiva por giro. Opcional: un servidor anterior no
   * la manda, y ausente se lee como «no está en la vitrina».
   */
  featuredForVertical?: boolean
  planTier: LaunchCampaignPlanTier
  billingInterval: LaunchCampaignInterval
  /** Precio FINAL por ciclo CON IVA, en centavos (2200 = $22.00). */
  advertisedPriceCents: number
  /** Ciclos a precio promocional (`duration_in_months` del cupón). */
  discountMonths: number
  currency: string
  offerVersion: number
  /** Congelados al ACTIVAR. Nulos mientras la ficha es un borrador. */
  listPriceCentsSnapshot: number | null
  discountAmountCents: number | null
  stripePriceId: string | null
  stripeCouponId: string | null
  validFrom: string
  validUntil: string
  redemptionCap: number
  redemptionCount: number
  headline: string | null
  subheadline: string | null
  bullets: string[]
  status: LaunchCampaignStatus
  statusReason: string | null
  activatedAt: string | null
  createdById: string | null
  updatedById: string | null
  createdAt: string
  updatedAt: string
}

export interface LaunchCampaignMetrics {
  /** Altas que dijeron venir de esta campaña (reclamo), hayan pagado o no. */
  claimed: number
  reserved: number
  applied: number
  released: number
  cap: number
  /** Lo que cuenta contra el cupo: RESERVED + APPLIED. */
  count: number
  /**
   * Apartados que llevan más de `staleReservedMinutes` sin cerrarse, contados por
   * el servidor sobre TODAS las filas (no sobre la página que esta pantalla trae).
   *
   * 🔴 Opcionales porque el contrato de §3 no los enumera: los manda el servidor
   * de este mismo carril, y un servidor anterior no los trae. Ausentes, la
   * pantalla recuenta con lo que tiene y lo declara como cota inferior; presentes,
   * gana este número, que es el único que ve las filas que no se descargaron.
   */
  staleReserved?: number
  staleReservedMinutes?: number
}

export interface LaunchCampaignDetail extends LaunchCampaignRow {
  metrics: LaunchCampaignMetrics
  availability: LaunchCampaignAvailability
}

/** Una fila de `GET /:id/redemptions`. Sin correos: §7.8. */
export interface RedemptionRow {
  id: string
  status: LaunchCampaignRedemptionStatus
  organization: { id: string; name: string }
  venue: { id: string; name: string; slug: string } | null
  advertisedPriceCents: number
  discountMonths: number
  listPriceCents: number
  offerVersion: number
  acquisitionSource: string | null
  utmSource: string | null
  utmCampaign: string | null
  reservedAt: string
  appliedAt: string | null
  releasedAt: string | null
}

export interface ListMeta {
  total: number
  page: number
  pageSize: number
}

/** Lo que el editor le manda a `POST /preview` — los cuatro campos de la oferta. */
export interface LaunchOfferPreviewInput {
  planTier: LaunchCampaignPlanTier
  billingInterval: LaunchCampaignInterval
  advertisedPriceCents: number
  discountMonths: number
}

/**
 * La respuesta de `POST /preview`. Es el ÚNICO lugar de donde salen los montos
 * que se pintan: el precio de lista vive en Stripe y esta pantalla no lo adivina.
 */
export interface LaunchOfferPreview {
  listPriceCents: number
  discountAmountCents: number
  firstChargeCents: number
  promoTotalCents: number
  renewalMonthlyCents: number
  promo: { subtotalCents: number; ivaCents: number }
  /** Lo que el servidor ya sabe que impediría activar. Se muestra tal cual. */
  problems: string[]
}

/** Cuerpo de `POST /` (crear). El servidor normaliza `code` y `landingSlug`. */
export interface CreateLaunchCampaignInput {
  code: string
  name: string
  landingSlug: string
  vertical: LaunchCampaignVertical
  channel: LaunchCampaignChannel | null
  planTier: LaunchCampaignPlanTier
  billingInterval: LaunchCampaignInterval
  advertisedPriceCents: number
  discountMonths: number
  validFrom: string
  validUntil: string
  redemptionCap: number
  headline: string | null
  subheadline: string | null
  bullets: string[]
  /** Marcarla le QUITA la vitrina a la otra campaña del mismo giro (en el servidor, atómico). */
  featuredForVertical?: boolean
}

/**
 * Lo que enseña HOY la página de un giro, leído del mismo endpoint público que la landing.
 * `null` = nadie ocupa la vitrina (la página calla el precio).
 */
export type VitrinaDelGiro =
  | { code: string; available: true; firstChargeCents: number }
  | { code: string; available: false; unavailableReason: string }
  | null

/**
 * Cuerpo de `PUT /:id`. Todo opcional salvo `expectedUpdatedAt`: la revisión
 * optimista es OBLIGATORIA — sin ella dos operadores se pisan en silencio.
 */
export type UpdateLaunchCampaignInput = Partial<Omit<CreateLaunchCampaignInput, 'code'>> & {
  expectedUpdatedAt: string
}

export interface LaunchCampaignListQuery {
  status?: LaunchCampaignStatus
  q?: string
  page?: number
  pageSize?: number
}

export interface RedemptionsQuery {
  status?: LaunchCampaignRedemptionStatus
  page?: number
  pageSize?: number
}
