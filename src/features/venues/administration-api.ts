import { api } from '@/shared/lib/api'
import type { EntityType, VenueType } from './api'
import type { KycStatus, VenueStatus } from './types'

export interface VenueAdministrationData {
  venue: {
    id: string
    organizationId: string
    name: string
    slug: string
    type: VenueType
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    zipCode: string | null
    phone: string | null
    email: string | null
    website: string | null
    latitude: number | null
    longitude: number | null
    language: string
    timezone: string
    currency: string
    entityType: EntityType | null
    rfc: string | null
    legalName: string | null
    fiscalRegime: string | null
    status: VenueStatus
    kycStatus: KycStatus | null
    suspensionReason: string | null
    updatedAt: string
  }
  organization: {
    id: string
    name: string
    email: string
    phone: string | null
    taxId: string | null
    billingEmail: string | null
    updatedAt: string
    venueCount: number
  }
  owner: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    updatedAt: string
    role: 'OWNER' | 'ADMIN'
    venueCount: number
  } | null
  allowedStatusTransitions: VenueStatus[]
}

export type AdministrationUpdate =
  | {
      section: 'profile'
      expectedUpdatedAt: string
      confirmSlugChange?: boolean
      changes: Partial<
        Pick<
          VenueAdministrationData['venue'],
          | 'name'
          | 'slug'
          | 'type'
          | 'address'
          | 'city'
          | 'state'
          | 'country'
          | 'zipCode'
          | 'phone'
          | 'email'
          | 'website'
          | 'latitude'
          | 'longitude'
          | 'language'
          | 'entityType'
          | 'rfc'
          | 'legalName'
          | 'fiscalRegime'
        >
      >
    }
  | {
      section: 'organization'
      expectedUpdatedAt: string
      expectedOrganizationId: string
      confirmShared: true
      changes: Partial<
        Pick<
          VenueAdministrationData['organization'],
          'name' | 'email' | 'phone' | 'taxId' | 'billingEmail'
        >
      >
    }
  | {
      section: 'owner'
      expectedUpdatedAt: string
      expectedOwnerId: string
      confirmShared: true
      changes: Partial<
        Pick<NonNullable<VenueAdministrationData['owner']>, 'firstName' | 'lastName' | 'phone'>
      >
    }
  | { section: 'status'; expectedUpdatedAt: string; status: VenueStatus; reason?: string }

export async function fetchVenueAdministration(venueId: string): Promise<VenueAdministrationData> {
  const { data } = await api.get<{ data: VenueAdministrationData }>(
    `/superadmin/venues/${venueId}/administration`,
  )
  return data.data
}

export async function updateVenueAdministration(venueId: string, update: AdministrationUpdate) {
  const { section, ...body } = update
  const { data } = await api.patch<{ data: VenueAdministrationData }>(
    `/superadmin/venues/${venueId}/${section}`,
    body,
  )
  return data.data
}
