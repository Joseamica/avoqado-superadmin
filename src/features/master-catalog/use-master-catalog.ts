import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchMasterCatalogOrganization,
  fetchMasterCatalogOrganizations,
  updateMasterCatalogConfig,
  updateMasterCatalogEntitlement,
  updateMasterCatalogGovernance,
  updateMasterCatalogModule,
} from './api'

export const MASTER_CATALOG_QUERY_KEY = ['superadmin', 'master-catalog'] as const

export function useMasterCatalogOrganizations(params: { cursor?: string; pageSize?: number } = {}) {
  return useQuery({
    queryKey: [...MASTER_CATALOG_QUERY_KEY, 'organizations', params],
    queryFn: () => fetchMasterCatalogOrganizations(params),
    staleTime: 30_000,
  })
}

export function useMasterCatalogOrganization(organizationId: string | null) {
  return useQuery({
    queryKey: [...MASTER_CATALOG_QUERY_KEY, 'organization', organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error('organizationId is required')
      return fetchMasterCatalogOrganization(organizationId)
    },
    enabled: organizationId !== null,
    staleTime: 15_000,
  })
}

function useControlMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MASTER_CATALOG_QUERY_KEY }),
  })
}

export function useUpdateMasterCatalogEntitlement() {
  return useControlMutation((variables: Parameters<typeof updateMasterCatalogEntitlement>) =>
    updateMasterCatalogEntitlement(...variables),
  )
}

export function useUpdateMasterCatalogModule() {
  return useControlMutation((variables: Parameters<typeof updateMasterCatalogModule>) =>
    updateMasterCatalogModule(...variables),
  )
}

export function useUpdateMasterCatalogConfig() {
  return useControlMutation((variables: Parameters<typeof updateMasterCatalogConfig>) =>
    updateMasterCatalogConfig(...variables),
  )
}

export function useUpdateMasterCatalogGovernance() {
  return useControlMutation((variables: Parameters<typeof updateMasterCatalogGovernance>) =>
    updateMasterCatalogGovernance(...variables),
  )
}
