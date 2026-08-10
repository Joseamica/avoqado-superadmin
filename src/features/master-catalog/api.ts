import { api } from '@/shared/lib/api'
import type {
  ControlMutationResult,
  EntitlementInput,
  MasterCatalogConfigV1,
  MasterCatalogOrganizationControl,
  MasterCatalogOrganizationPage,
} from './types'

interface Envelope<T> {
  success: boolean
  data: T
}

const BASE = '/superadmin/master-catalog'

function isConfigV1(value: unknown): value is MasterCatalogConfigV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const config = value as Record<string, unknown>
  const keys = [
    'schemaVersion',
    'catalogCoreEnabled',
    'identifiersEnabled',
    'regionalPricingEnabled',
    'governanceMode',
  ]
  return (
    Object.keys(config).length === keys.length &&
    keys.every((key) => key in config) &&
    config.schemaVersion === 1 &&
    typeof config.catalogCoreEnabled === 'boolean' &&
    typeof config.identifiersEnabled === 'boolean' &&
    typeof config.regionalPricingEnabled === 'boolean' &&
    ['OFF', 'ADVISORY', 'ENFORCED'].includes(String(config.governanceMode))
  )
}

export async function fetchMasterCatalogOrganizations(
  params: { cursor?: string; pageSize?: number } = {},
): Promise<MasterCatalogOrganizationPage> {
  const { data } = await api.get<Envelope<MasterCatalogOrganizationPage>>(`${BASE}/organizations`, {
    params,
  })
  return data.data
}

export async function fetchMasterCatalogOrganization(
  organizationId: string,
): Promise<MasterCatalogOrganizationControl> {
  const { data } = await api.get<Envelope<MasterCatalogOrganizationControl>>(
    `${BASE}/organizations/${encodeURIComponent(organizationId)}`,
  )
  const result = data.data
  if (result.access.config !== null && !isConfigV1(result.access.config)) {
    return {
      ...result,
      access: { ...result.access, config: null, reasonCode: 'CONFIG_INVALID' },
    }
  }
  return result
}

export async function updateMasterCatalogEntitlement(
  organizationId: string,
  input: EntitlementInput,
): Promise<ControlMutationResult> {
  const { data } = await api.put<Envelope<ControlMutationResult>>(
    `${BASE}/organizations/${encodeURIComponent(organizationId)}/entitlement`,
    input,
  )
  return data.data
}

export async function updateMasterCatalogModule(
  organizationId: string,
  input: { enabled: boolean },
): Promise<ControlMutationResult> {
  const { data } = await api.put<Envelope<ControlMutationResult>>(
    `${BASE}/organizations/${encodeURIComponent(organizationId)}/module`,
    input,
  )
  return data.data
}

export async function updateMasterCatalogConfig(
  organizationId: string,
  input: { config: MasterCatalogConfigV1 },
): Promise<ControlMutationResult> {
  const { data } = await api.put<Envelope<ControlMutationResult>>(
    `${BASE}/organizations/${encodeURIComponent(organizationId)}/config`,
    input,
  )
  return data.data
}

export async function updateMasterCatalogGovernance(
  organizationId: string,
  venueId: string,
  input: { governanceState: 'ENFORCED' },
): Promise<ControlMutationResult> {
  const { data } = await api.put<Envelope<ControlMutationResult>>(
    `${BASE}/organizations/${encodeURIComponent(organizationId)}/venues/${encodeURIComponent(venueId)}/governance`,
    input,
  )
  return data.data
}
