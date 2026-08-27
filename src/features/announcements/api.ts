/**
 * API client del feature Announcements.
 *
 * Apunta al namespace `/api/v1/superadmin/announcements/*`, que es donde nacieron estos
 * endpoints — no hay variante legacy en `/dashboard/superadmin/*` que migrar. El envelope
 * `{ success, data }` se desenvuelve acá, como en el resto del namespace.
 */
import { api } from '@/shared/lib/api'
import type {
  Announcement,
  AnnouncementInput,
  AnnouncementMetrics,
  AudienceFilters,
  AudiencePreview,
} from './types'

interface SuperadminEnvelope<T> {
  success: boolean
  data: T
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get<SuperadminEnvelope<{ announcements: Announcement[] }>>('/superadmin/announcements')
  return data.data?.announcements ?? []
}

export async function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  const { data } = await api.post<SuperadminEnvelope<{ announcement: Announcement }>>('/superadmin/announcements', input)
  return data.data.announcement
}

export async function updateAnnouncement(id: string, input: Partial<AnnouncementInput>): Promise<Announcement> {
  const { data } = await api.put<SuperadminEnvelope<{ announcement: Announcement }>>(
    `/superadmin/announcements/${id}`,
    input,
  )
  return data.data.announcement
}

/**
 * El conteo en vivo del compositor.
 *
 * Devuelve DOS números distintos a propósito: una persona puede administrar varios
 * negocios, así que "37 negocios" y "37 personas" casi nunca coinciden.
 */
export async function previewAudience(filters: AudienceFilters): Promise<AudiencePreview> {
  const { data } = await api.post<SuperadminEnvelope<AudiencePreview>>(
    '/superadmin/announcements/preview-audience',
    filters,
  )
  return data.data
}

/** Sin `scheduledFor` publica ya; con fecha lo deja programado para el job. */
export async function publishAnnouncement(id: string, scheduledFor?: string): Promise<void> {
  await api.post(`/superadmin/announcements/${id}/publish`, scheduledFor ? { scheduledFor } : {})
}

export async function archiveAnnouncement(id: string): Promise<void> {
  await api.post(`/superadmin/announcements/${id}/archive`, {})
}

export async function fetchAnnouncementMetrics(id: string): Promise<AnnouncementMetrics> {
  const { data } = await api.get<SuperadminEnvelope<AnnouncementMetrics>>(`/superadmin/announcements/${id}/metrics`)
  return data.data
}

/** Si no hay llave de IA, el compositor esconde el botón en vez de fallar al tocarlo. */
export async function fetchCapabilities(): Promise<{ aiCopy: boolean }> {
  const { data } = await api.get<SuperadminEnvelope<{ aiCopy: boolean }>>('/superadmin/announcements/capabilities')
  return data.data
}
