import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  activateLaunchCampaign,
  createLaunchCampaign,
  endLaunchCampaign,
  fetchLaunchCampaign,
  fetchLaunchCampaigns,
  fetchRedemptions,
  fetchVitrinaDelGiro,
  pauseLaunchCampaign,
  previewLaunchOffer,
  updateLaunchCampaign,
} from './api'
import type {
  CreateLaunchCampaignInput,
  LaunchCampaignListQuery,
  LaunchCampaignVertical,
  LaunchOfferPreviewInput,
  UpdateLaunchCampaignInput,
} from './types'

export const LAUNCH_CAMPAIGNS_QUERY_KEY = ['superadmin', 'launch-campaigns'] as const

/** Lo que el detalle considera "apartado hace demasiado". */
export const RESERVA_VIEJA_MS = 30 * 60_000

export function useLaunchCampaigns(query: LaunchCampaignListQuery = {}) {
  return useQuery({
    queryKey: [...LAUNCH_CAMPAIGNS_QUERY_KEY, 'list', query],
    queryFn: () => fetchLaunchCampaigns(query),
    staleTime: 30_000,
  })
}

/**
 * Lo que la página pública de un giro está enseñando ahora. Cuelga de la llave de campañas, así
 * que se relee sola después de marcar, pausar o terminar una.
 */
export function useVitrinaDelGiro(vertical: LaunchCampaignVertical) {
  return useQuery({
    queryKey: [...LAUNCH_CAMPAIGNS_QUERY_KEY, 'vitrina', vertical],
    queryFn: () => fetchVitrinaDelGiro(vertical),
    staleTime: 30_000,
  })
}

export function useLaunchCampaign(id: string | null) {
  return useQuery({
    queryKey: [...LAUNCH_CAMPAIGNS_QUERY_KEY, 'detail', id],
    queryFn: () => fetchLaunchCampaign(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
  })
}

/**
 * Las redenciones, paginadas EN EL SERVIDOR.
 *
 * Nunca se traen todas: una campaña llena son miles de filas y el operador casi
 * siempre mira las primeras. «Cargar más» pide la página siguiente.
 */
export function useRedemptions(id: string | null, pageSize = 50) {
  return useInfiniteQuery({
    queryKey: [...LAUNCH_CAMPAIGNS_QUERY_KEY, 'redemptions', id, pageSize],
    queryFn: ({ pageParam }) => fetchRedemptions(id as string, { page: pageParam, pageSize }),
    enabled: Boolean(id),
    initialPageParam: 1,
    getNextPageParam: (ultima) => {
      const vistas = ultima.meta.page * ultima.meta.pageSize
      return vistas < ultima.meta.total ? ultima.meta.page + 1 : undefined
    },
    staleTime: 15_000,
  })
}

/**
 * Los lugares APARTADOS, para la alerta del detalle.
 *
 * 🔴 No es una métrica decorativa: es lo único que hace visible el riesgo de que
 * un lugar RESERVED que nadie reintenta consuma cupo para siempre. El barrido
 * automático que los liberaría no existe en fase 1, así que si esto no se ve,
 * nadie se entera nunca — la campaña se queda "llena" con lugares fantasma.
 */
export function useReservasVivas(id: string | null) {
  return useQuery({
    queryKey: [...LAUNCH_CAMPAIGNS_QUERY_KEY, 'reserved', id],
    queryFn: () => fetchRedemptions(id as string, { status: 'RESERVED', page: 1, pageSize: 100 }),
    enabled: Boolean(id),
    staleTime: 15_000,
  })
}

/**
 * Los montos del editor. `input` llega YA debounceado: sin eso sería una llamada
 * a Stripe por cada tecla del precio.
 */
export function useLaunchOfferPreview(input: LaunchOfferPreviewInput | null, enabled: boolean) {
  return useQuery({
    queryKey: [...LAUNCH_CAMPAIGNS_QUERY_KEY, 'preview', input],
    queryFn: () => previewLaunchOffer(input as LaunchOfferPreviewInput),
    enabled: enabled && input !== null,
    staleTime: 60_000,
    retry: false,
  })
}

/** Toda mutación invalida la llave raíz: lista, detalle y redenciones cuelgan de ella. */
function useInvalidar() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: LAUNCH_CAMPAIGNS_QUERY_KEY })
}

export function useCreateLaunchCampaign() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (input: CreateLaunchCampaignInput) => createLaunchCampaign(input),
    onSuccess: () => {
      invalidar()
      toast.success('Campaña guardada como borrador', {
        description: 'Todavía no está publicada: actívala cuando el anuncio esté listo.',
      })
    },
    onError: (e) => {
      const i = inspectApiError(e, 'guardar la campaña')
      toast.error(i.title, { description: i.serverMessage ?? i.description })
    },
  })
}

export function useUpdateLaunchCampaign() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLaunchCampaignInput }) =>
      updateLaunchCampaign(id, input),
    onSuccess: () => {
      invalidar()
      toast.success('Campaña actualizada')
    },
    onError: (e) => {
      // El 409 `STALE` y el 400 `CAP_BELOW_COUNT` traen su propio mensaje del
      // servidor; se muestra ése y no una frase genérica, porque dicen QUÉ hacer.
      const i = inspectApiError(e, 'actualizar la campaña')
      toast.error(i.title, { description: i.serverMessage ?? i.description })
    },
  })
}

export function useActivateLaunchCampaign() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      activateLaunchCampaign(id, reason),
    onSuccess: (ficha) => {
      invalidar()
      toast.success('Campaña activa', {
        description: ficha.stripeCouponId
          ? `Cupón ${ficha.stripeCouponId} listo en Stripe.`
          : 'La oferta ya se puede cobrar.',
      })
    },
    onError: (e) => {
      const i = inspectApiError(e, 'activar la campaña')
      toast.error(i.title, { description: i.serverMessage ?? i.description })
    },
  })
}

export function usePauseLaunchCampaign() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => pauseLaunchCampaign(id, reason),
    onSuccess: () => {
      invalidar()
      toast.success('Campaña pausada', {
        description:
          'Deja de ofrecerse en la landing. Quien ya apartó su lugar conserva su precio.',
      })
    },
    onError: (e) => {
      const i = inspectApiError(e, 'pausar la campaña')
      toast.error(i.title, { description: i.serverMessage ?? i.description })
    },
  })
}

export function useEndLaunchCampaign() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => endLaunchCampaign(id, reason),
    onSuccess: () => {
      invalidar()
      toast.success('Campaña terminada')
    },
    onError: (e) => {
      const i = inspectApiError(e, 'terminar la campaña')
      toast.error(i.title, { description: i.serverMessage ?? i.description })
    },
  })
}
