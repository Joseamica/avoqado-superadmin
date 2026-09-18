/**
 * API client de las campañas de lanzamiento.
 *
 * Namespace `/api/v1/superadmin/launch-campaigns/*` — nacido ahí, sin variante
 * legacy en `/dashboard/superadmin/*` que migrar. El candado es el rol SUPERADMIN
 * que ya aplica el router padre del servidor: no hay permiso nuevo que espejear.
 */
import { api } from '@/shared/lib/api'
import type {
  CreateLaunchCampaignInput,
  LaunchCampaignDetail,
  LaunchCampaignListQuery,
  LaunchCampaignRow,
  LaunchOfferPreview,
  LaunchOfferPreviewInput,
  ListMeta,
  RedemptionRow,
  RedemptionsQuery,
  UpdateLaunchCampaignInput,
} from './types'

const BASE = '/superadmin/launch-campaigns'

interface SuperadminEnvelope<T> {
  success: boolean
  data: T
  meta?: ListMeta
}

export interface Paginado<T> {
  rows: T[]
  meta: ListMeta
}

/** `meta` es opcional en el envelope; una lista sin él no puede paginar a ciegas. */
function metaOr<T>(
  meta: ListMeta | undefined,
  rows: T[],
  page: number,
  pageSize: number,
): ListMeta {
  return meta ?? { total: rows.length, page, pageSize }
}

export async function fetchLaunchCampaigns(
  query: LaunchCampaignListQuery = {},
): Promise<Paginado<LaunchCampaignRow>> {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 25
  const { data } = await api.get<SuperadminEnvelope<LaunchCampaignRow[]>>(BASE, {
    params: {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { q: query.q } : {}),
      page,
      pageSize,
    },
  })
  const rows = data.data ?? []
  return { rows, meta: metaOr(data.meta, rows, page, pageSize) }
}

export async function fetchLaunchCampaign(id: string): Promise<LaunchCampaignDetail> {
  const { data } = await api.get<SuperadminEnvelope<LaunchCampaignDetail>>(`${BASE}/${id}`)
  return data.data
}

export async function createLaunchCampaign(
  input: CreateLaunchCampaignInput,
): Promise<LaunchCampaignRow> {
  const { data } = await api.post<SuperadminEnvelope<LaunchCampaignRow>>(BASE, input)
  return data.data
}

/**
 * 🔴 `expectedUpdatedAt` no es opcional: es la revisión optimista. Sin ella dos
 * operadores editando la misma ficha se pisan y el último gana en silencio; con
 * ella el servidor contesta 409 `LAUNCH_CAMPAIGN_STALE` y la pantalla lo dice.
 */
export async function updateLaunchCampaign(
  id: string,
  input: UpdateLaunchCampaignInput,
): Promise<LaunchCampaignRow> {
  const { data } = await api.put<SuperadminEnvelope<LaunchCampaignRow>>(`${BASE}/${id}`, input)
  return data.data
}

/**
 * Los montos que se pintan en el editor. SÓLO lee el precio de Stripe: no crea
 * cupones ni toca la ficha. El precio de lista vive allá y esta pantalla no lo
 * adivina nunca.
 */
export async function previewLaunchOffer(
  input: LaunchOfferPreviewInput,
): Promise<LaunchOfferPreview> {
  const { data } = await api.post<SuperadminEnvelope<LaunchOfferPreview>>(`${BASE}/preview`, input)
  return data.data
}

/** Crea o reutiliza el cupón en Stripe y deja la ficha ACTIVE. */
export async function activateLaunchCampaign(
  id: string,
  reason?: string,
): Promise<LaunchCampaignRow> {
  const { data } = await api.post<SuperadminEnvelope<LaunchCampaignRow>>(
    `${BASE}/${id}/activate`,
    reason ? { reason } : {},
  )
  return data.data
}

export async function pauseLaunchCampaign(id: string, reason: string): Promise<LaunchCampaignRow> {
  const { data } = await api.post<SuperadminEnvelope<LaunchCampaignRow>>(`${BASE}/${id}/pause`, {
    reason,
  })
  return data.data
}

/** Irreversible: para cambiar el precio se crea otra ficha con otro código. */
export async function endLaunchCampaign(id: string, reason: string): Promise<LaunchCampaignRow> {
  const { data } = await api.post<SuperadminEnvelope<LaunchCampaignRow>>(`${BASE}/${id}/end`, {
    reason,
  })
  return data.data
}

/** Paginado EN EL SERVIDOR: una campaña llena son miles de filas. */
export async function fetchRedemptions(
  id: string,
  query: RedemptionsQuery = {},
): Promise<Paginado<RedemptionRow>> {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 50
  const { data } = await api.get<SuperadminEnvelope<RedemptionRow[]>>(`${BASE}/${id}/redemptions`, {
    params: {
      ...(query.status ? { status: query.status } : {}),
      page,
      pageSize,
    },
  })
  const rows = data.data ?? []
  return { rows, meta: metaOr(data.meta, rows, page, pageSize) }
}
