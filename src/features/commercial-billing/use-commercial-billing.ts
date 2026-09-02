import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  approveManualSpeiCase,
  fetchManualSpeiCase,
  fetchManualSpeiCases,
  fetchManualSpeiEvidenceAccess,
  reviewManualSpeiEvidence,
  type ApproveManualSpeiCaseInput,
  type ReviewManualSpeiEvidenceInput,
} from './api'

export const COMMERCIAL_BILLING_QUERY_KEY = ['superadmin', 'commercial-billing'] as const

export function useManualSpeiCases() {
  return useInfiniteQuery({
    queryKey: [...COMMERCIAL_BILLING_QUERY_KEY, 'manual-spei-cases'],
    queryFn: ({ pageParam }) =>
      fetchManualSpeiCases({ cursor: pageParam === null ? undefined : pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}

export function useManualSpeiCase(caseId: string | null) {
  return useQuery({
    queryKey: [...COMMERCIAL_BILLING_QUERY_KEY, 'manual-spei-case', caseId],
    queryFn: () => fetchManualSpeiCase(caseId!),
    enabled: Boolean(caseId),
    staleTime: 15_000,
  })
}

export function useManualSpeiActions() {
  const queryClient = useQueryClient()
  const invalidate = (caseId: string) => {
    queryClient.invalidateQueries({
      queryKey: [...COMMERCIAL_BILLING_QUERY_KEY, 'manual-spei-cases'],
    })
    queryClient.invalidateQueries({
      queryKey: [...COMMERCIAL_BILLING_QUERY_KEY, 'manual-spei-case', caseId],
    })
  }

  const reviewEvidence = useMutation({
    mutationFn: (input: ReviewManualSpeiEvidenceInput & { caseId: string }) => {
      const { caseId: _caseId, ...payload } = input
      return reviewManualSpeiEvidence(payload)
    },
    onSuccess: (_, input) => {
      invalidate(input.caseId)
      toast.success(input.action === 'ACCEPT' ? 'Evidencia aceptada' : 'Evidencia rechazada')
    },
    onError: (error) => {
      const info = inspectApiError(error, 'revisar la evidencia SPEI')
      toast.error(info.title, { description: info.description })
    },
  })

  const openEvidence = useMutation({
    mutationFn: fetchManualSpeiEvidenceAccess,
    onSuccess: (access) => {
      window.open(access.url, '_blank', 'noopener,noreferrer')
    },
    onError: (error) => {
      const info = inspectApiError(error, 'abrir la evidencia SPEI')
      toast.error(info.title, { description: info.description })
    },
  })

  const approveCase = useMutation({
    mutationFn: (input: ApproveManualSpeiCaseInput) => approveManualSpeiCase(input),
    onSuccess: (_, input) => {
      invalidate(input.caseId)
      toast.success('Aprobación registrada')
    },
    onError: (error) => {
      const info = inspectApiError(error, 'aprobar la conciliación SPEI')
      toast.error(info.title, { description: info.description })
    },
  })

  return { reviewEvidence, openEvidence, approveCase }
}
