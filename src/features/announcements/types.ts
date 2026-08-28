/**
 * Anuncios de plataforma — Avoqado le habla a sus negocios.
 *
 * Diseño: `docs/superpowers/specs/2026-08-27-anuncios-de-plataforma-design.md` (workspace).
 * Backend: `/api/v1/superadmin/announcements/*` en avoqado-server.
 */

export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'

export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export type PlanTier = 'GRATIS' | 'PRO' | 'PREMIUM' | 'ENTERPRISE'

export type BusinessCategory = 'FOOD_SERVICE' | 'RETAIL' | 'SERVICES' | 'HOSPITALITY' | 'ENTERTAINMENT' | 'OTHER'

/** Los roles que pueden recibir un anuncio. El default del backend es OWNER + ADMIN. */
export type AudienceRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN' | 'HOST' | 'VIEWER'

/**
 * Bloques del contenido ampliado — lo que se ve al hacer clic.
 *
 * 🔴 El catálogo debe coincidir EXACTO con el `discriminatedUnion` de Zod del servidor:
 * un `type` que no esté allá se rechaza al guardar. Y cada cliente ignora los que no
 * conoce, así que agregar uno nuevo nunca rompe una app vieja.
 */
export type ContentBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'image'; url: string; alt: string; caption?: string }
  | { type: 'gallery'; images: Array<{ url: string; alt: string; caption?: string }> }
  | { type: 'specs'; rows: Array<{ label: string; value: string }> }
  | { type: 'callout'; tone: 'info' | 'warning' | 'success'; text: string }
  | { type: 'button'; label: string; url: string }
  | { type: 'video'; provider: 'youtube' | 'vimeo'; videoId: string; thumbnailUrl?: string }
  | { type: 'divider' }

export interface AudienceFilters {
  audienceRoles: AudienceRole[]
  targetPlanTiers: PlanTier[]
  targetCategories: BusinessCategory[]
  targetVenueIds: string[]
}

export interface Announcement extends AudienceFilters {
  id: string
  title: string
  body: string
  imageUrl?: string | null
  priority: AnnouncementPriority
  actionLabel?: string | null
  actionUrl?: string | null
  contentBlocks?: ContentBlock[] | null
  showAsBanner: boolean
  /** Interrumpe con una ventana la próxima vez que entren. Se cierra una vez y luego vive en la campana. */
  showAsModal: boolean
  status: AnnouncementStatus
  publishedAt?: string | null
  scheduledFor?: string | null
  expiresAt?: string | null
  deliveredCount: number
  /** Negocios distintos alcanzados. NO es lo mismo que entregas. */
  reachedVenues?: number
  /** Personas distintas alcanzadas. Una persona con 12 sucursales cuenta UNA vez. */
  reachedPeople?: number
  deliveredAt?: string | null
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
}

export type AnnouncementInput = AudienceFilters & {
  title: string
  body: string
  imageUrl?: string
  priority: AnnouncementPriority
  actionLabel?: string
  actionUrl?: string
  contentBlocks?: ContentBlock[]
  showAsBanner: boolean
  showAsModal: boolean
  expiresAt?: string
}

/** Lo que devuelve el conteo en vivo mientras se mueven los filtros. */
export interface AudiencePreview {
  venues: number
  people: number
}

/**
 * ⚠️ `read` y `opened` son cosas DISTINTAS y nunca se suman: marcar leído en la campana
 * no significa que alguien haya abierto el anuncio.
 */
export interface AnnouncementMetrics {
  /** Negocios distintos alcanzados. NO son entregas. */
  reachedVenues: number
  /** Personas distintas. Alguien con 12 sucursales cuenta UNA vez. */
  reachedPeople: number
  delivered: number
  read: number
  opened: number
  cta: number
}
