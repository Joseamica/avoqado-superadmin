export type GovernanceMode = 'OFF' | 'ADVISORY' | 'ENFORCED'
export type EntitlementStatus = 'ACTIVE' | 'REVOKED'
export type EntitlementSource = 'CONTRACT' | 'CUSTOM'
export type CatalogClientFamily = 'DASHBOARD' | 'ANDROID' | 'IOS' | 'TPV' | 'DESKTOP'

export interface MasterCatalogConfigV1 {
  schemaVersion: 1
  catalogCoreEnabled: boolean
  identifiersEnabled: boolean
  regionalPricingEnabled: boolean
  governanceMode: GovernanceMode
}

export const SAFE_MASTER_CATALOG_CONFIG: MasterCatalogConfigV1 = {
  schemaVersion: 1,
  catalogCoreEnabled: false,
  identifiersEnabled: false,
  regionalPricingEnabled: false,
  governanceMode: 'OFF',
}

export interface StaffSummary {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

export interface MasterCatalogOrganizationSummary {
  id: string
  name: string
  slug: string | null
  _count: { venues: number }
}

export interface MasterCatalogOrganizationPage {
  items: MasterCatalogOrganizationSummary[]
  nextCursor: string | null
}

export interface MasterCatalogEntitlement {
  id: string
  status: EntitlementStatus
  source: EntitlementSource
  startsAt: string
  endsAt: string | null
  reason: string
  grantedById: string
  createdAt: string
  updatedAt: string
  grantedBy: StaffSummary
}

export interface MasterCatalogModuleAssignment {
  id: string
  enabled: boolean
  enabledBy: string
  enabledAt: string
  createdAt: string
  updatedAt: string
  definitionActive: boolean
  scope: 'ORGANIZATION_ONLY' | 'BOTH' | 'VENUE_ONLY'
}

export type MasterCatalogAccessReason =
  | 'ACCESSIBLE'
  | 'ENTITLEMENT_MISSING'
  | 'ENTITLEMENT_INACTIVE'
  | 'MODULE_MISSING'
  | 'MODULE_INACTIVE'
  | 'CONFIG_MISSING'
  | 'CONFIG_INVALID'
  | 'GATE_DISABLED'
  | 'ROLE_DENIED'
  | 'DEPENDENCY_UNAVAILABLE'

export interface MasterCatalogAccess {
  organizationId: string
  orgRole: 'OWNER' | 'ADMIN' | 'VIEWER' | 'MEMBER' | null
  entitlementActive: boolean
  moduleActive: boolean
  config: MasterCatalogConfigV1 | null
  reasonCode: MasterCatalogAccessReason
  canRead: boolean
  canMutateContent: boolean
  canConfigureControlPlane: boolean
}

export interface MasterCatalogRollout {
  registryState:
    | 'NOT_STARTED'
    | 'PREFLIGHT_FAILED'
    | 'READY_TO_BOOTSTRAP'
    | 'BOOTSTRAPPING'
    | 'READY'
  aliasPublicationState: 'DISABLED' | 'CLIENTS_NOT_READY' | 'READY_TO_ENABLE' | 'ENABLED' | 'PAUSED'
  governanceState: 'NOT_STARTED' | 'CLIENTS_NOT_READY' | 'READY_TO_ENFORCE' | 'ENFORCED' | 'PAUSED'
  identifierRevision: string
  createdAt: string | null
  updatedAt: string | null
  updatedBy: StaffSummary | null
}

export interface CatalogClientRequirement {
  family: CatalogClientFamily
  mode: 'REQUIRED' | 'NOT_APPLICABLE'
  minimumVersion: string | null
  maxObservationAgeDays: number
}

export interface CatalogClientObservation {
  venueId: string
  family: CatalogClientFamily
  deviceId: string
  appVersion: string
  lastSeenAt: string
  source: string
  stale: boolean
  compatible: boolean
}

export interface CatalogReadinessOverride {
  id: string
  family: CatalogClientFamily | null
  status: 'NOT_STARTED' | 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  reason: string
  expiresAt: string
  revokedAt: string | null
  revocationReason: string | null
  createdAt: string
  updatedAt: string
}

export interface CatalogClientReadiness {
  state: 'NOT_CONFIGURED' | 'READY' | 'NOT_READY' | 'OVERRIDDEN'
  requiredFamilies: CatalogClientFamily[]
  missingFamilies: CatalogClientFamily[]
  staleFamilies: CatalogClientFamily[]
  incompatibleFamilies: CatalogClientFamily[]
  requirements: CatalogClientRequirement[]
  latestObservations: CatalogClientObservation[]
  activeOverrides: CatalogReadinessOverride[]
}

export type CatalogControlActor =
  | { type: 'SERVICE'; servicePrincipalId: string }
  | { type: 'HUMAN'; staffId: string; staff: StaffSummary | null }

export interface CatalogLastFailure {
  code: string | null
  message: string | null
  occurredAt: string
  actor: CatalogControlActor | null
}

export interface MasterCatalogVenueControl {
  id: string
  name: string
  currency: string
  timezone: string
  catalogGovernanceEnforcedAt: string | null
  rollout: MasterCatalogRollout
  readiness: CatalogClientReadiness
  lastFailure: CatalogLastFailure | null
}

export interface MasterCatalogOrganizationControl {
  organization: { id: string; name: string; slug: string | null }
  entitlement: MasterCatalogEntitlement | null
  module: MasterCatalogModuleAssignment | null
  access: MasterCatalogAccess
  venues: MasterCatalogVenueControl[]
}

export interface EntitlementInput {
  status: EntitlementStatus
  source: EntitlementSource
  reason: string
  startsAt: string
  endsAt: string | null
}

export interface ControlMutationResult<TBefore = unknown, TAfter = unknown> {
  before: TBefore
  after: TAfter
}
