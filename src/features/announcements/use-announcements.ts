import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  archiveAnnouncement,
  createAnnouncement,
  fetchAnnouncementMetrics,
  fetchAnnouncements,
  fetchCapabilities,
  previewAudience,
  publishAnnouncement,
  updateAnnouncement,
} from './api'
import type { AnnouncementInput, AudienceFilters } from './types'

export const ANNOUNCEMENTS_QUERY_KEY = ['superadmin', 'announcements'] as const

export function useAnnouncements() {
  return useQuery({
    queryKey: ANNOUNCEMENTS_QUERY_KEY,
    queryFn: fetchAnnouncements,
    staleTime: 30_000,
  })
}

export function useAnnouncementMetrics(id: string | null) {
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_QUERY_KEY, 'metrics', id],
    queryFn: () => fetchAnnouncementMetrics(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  })
}

export function useAnnouncementCapabilities() {
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_QUERY_KEY, 'capabilities'],
    queryFn: fetchCapabilities,
    staleTime: 5 * 60_000,
  })
}

/**
 * Conteo en vivo de la audiencia.
 *
 * 🔴 `filters` llega YA debounceado desde el editor. Sin eso sería una consulta por cada
 * tecla, y del otro lado esa consulta recorre los vínculos de todo el personal.
 */
export function useAudiencePreview(filters: AudienceFilters, enabled: boolean) {
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_QUERY_KEY, 'preview', filters],
    queryFn: () => previewAudience(filters),
    enabled,
    staleTime: 10_000,
  })
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AnnouncementInput) => createAnnouncement(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY })
      toast.success('Anuncio guardado como borrador')
    },
    onError: e => {
      const i = inspectApiError(e, 'guardar el anuncio')
      toast.error(i.title, { description: i.description })
    },
  })
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AnnouncementInput> }) => updateAnnouncement(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY })
      toast.success('Anuncio actualizado')
    },
    onError: e => {
      const i = inspectApiError(e, 'actualizar el anuncio')
      toast.error(i.title, { description: i.description })
    },
  })
}

export function usePublishAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, scheduledFor }: { id: string; scheduledFor?: string }) => publishAnnouncement(id, scheduledFor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY })
      toast.success(variables.scheduledFor ? 'Anuncio programado' : 'Anuncio publicado')
    },
    onError: e => {
      const i = inspectApiError(e, 'publicar el anuncio')
      toast.error(i.title, { description: i.description })
    },
  })
}

export function useArchiveAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY })
      toast.success('Anuncio archivado')
    },
    onError: e => {
      const i = inspectApiError(e, 'archivar el anuncio')
      toast.error(i.title, { description: i.description })
    },
  })
}
