import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test/render'
import { MasterCatalogRolloutTable } from './MasterCatalogRolloutTable'
import type { MasterCatalogVenueControl } from './types'

const venue: MasterCatalogVenueControl = {
  id: 'venue-pits',
  name: 'PITS Centro',
  currency: 'MXN',
  timezone: 'America/Mexico_City',
  catalogGovernanceEnforcedAt: null,
  rollout: {
    registryState: 'READY',
    aliasPublicationState: 'READY_TO_ENABLE',
    governanceState: 'READY_TO_ENFORCE',
    identifierRevision: '12',
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T18:00:00.000Z',
    updatedBy: { id: 'staff-root', firstName: 'Ana', lastName: 'Admin', email: 'ana@example.com' },
  },
  readiness: {
    state: 'NOT_READY',
    requiredFamilies: ['TPV', 'ANDROID'],
    missingFamilies: ['ANDROID'],
    staleFamilies: ['TPV'],
    incompatibleFamilies: [],
    requirements: [],
    latestObservations: [],
    activeOverrides: [],
  },
  lastFailure: {
    code: 'CATALOG_PUBLICATION_STALE',
    message: 'Una publicación previa falló.',
    occurredAt: '2026-08-09T18:00:00.000Z',
    actor: { type: 'SERVICE', servicePrincipalId: 'CATALOG_WATCHDOG' },
  },
}

describe('MasterCatalogRolloutTable', () => {
  it('shows rollout, readiness, client drift, actor/date and failure without content controls', async () => {
    const onRequestEnforcement = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <MasterCatalogRolloutTable venues={[venue]} onRequestEnforcement={onRequestEnforcement} />,
    )

    expect(screen.getByText('PITS Centro')).toBeInTheDocument()
    expect(screen.getByText('READY_TO_ENFORCE')).toBeInTheDocument()
    expect(screen.getByText('TPV stale')).toBeInTheDocument()
    expect(screen.getByText('ANDROID sin observación')).toBeInTheDocument()
    expect(screen.getByText('CATALOG_WATCHDOG')).toBeInTheDocument()
    expect(screen.getByText('Una publicación previa falló.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /producto|precio/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Solicitar ENFORCED para PITS Centro' }))
    expect(onRequestEnforcement).toHaveBeenCalledWith(venue)
  })
})
