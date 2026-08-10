import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { MasterCatalogAccessPage } from './MasterCatalogAccessPage'

const baseURL = 'http://localhost:3000/api/v1'
let entitlementWrites = 0

function detail(entitlement: unknown = null) {
  return {
    organization: { id: 'org-pits', name: 'PITS', slug: 'pits' },
    entitlement,
    module: {
      id: 'module-assignment-1',
      enabled: true,
      enabledBy: 'staff-root',
      enabledAt: '2026-08-09T00:00:00.000Z',
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-09T00:00:00.000Z',
      definitionActive: true,
      scope: 'ORGANIZATION_ONLY',
    },
    access: {
      organizationId: 'org-pits',
      orgRole: null,
      entitlementActive: Boolean(entitlement),
      moduleActive: true,
      config: {
        schemaVersion: 1,
        catalogCoreEnabled: false,
        identifiersEnabled: false,
        regionalPricingEnabled: false,
        governanceMode: 'OFF',
      },
      reasonCode: entitlement ? 'GATE_DISABLED' : 'ENTITLEMENT_MISSING',
      canRead: false,
      canMutateContent: false,
      canConfigureControlPlane: true,
    },
    venues: [
      {
        id: 'venue-pits',
        name: 'PITS Centro',
        currency: 'MXN',
        timezone: 'America/Mexico_City',
        catalogGovernanceEnforcedAt: null,
        rollout: {
          registryState: 'READY',
          aliasPublicationState: 'CLIENTS_NOT_READY',
          governanceState: 'CLIENTS_NOT_READY',
          identifierRevision: '0',
          createdAt: '2026-08-09T00:00:00.000Z',
          updatedAt: '2026-08-09T18:00:00.000Z',
          updatedBy: {
            id: 'staff-root',
            firstName: 'Ana',
            lastName: 'Admin',
            email: 'ana@example.com',
          },
        },
        readiness: {
          state: 'NOT_READY',
          requiredFamilies: ['TPV'],
          missingFamilies: [],
          staleFamilies: ['TPV'],
          incompatibleFamilies: [],
          requirements: [],
          latestObservations: [
            {
              venueId: 'venue-pits',
              family: 'TPV',
              deviceId: 'device-1',
              appVersion: '2.1.0',
              lastSeenAt: '2026-01-01T00:00:00.000Z',
              source: 'heartbeat',
              stale: true,
              compatible: true,
            },
          ],
          activeOverrides: [],
        },
        lastFailure: {
          code: 'CATALOG_PUBLICATION_STALE',
          message: 'La publicación quedó stale.',
          occurredAt: '2026-08-09T18:00:00.000Z',
          actor: {
            type: 'HUMAN',
            staffId: 'staff-root',
            staff: {
              id: 'staff-root',
              firstName: 'Ana',
              lastName: 'Admin',
              email: 'ana@example.com',
            },
          },
        },
      },
    ],
  }
}

const server = setupServer(
  http.get(`${baseURL}/dashboard/auth/status`, () =>
    HttpResponse.json({
      authenticated: true,
      user: {
        id: 'staff-root',
        email: 'ana@example.com',
        firstName: 'Ana',
        lastName: 'Admin',
        photoUrl: null,
        role: 'SUPERADMIN',
        venues: [],
      },
    }),
  ),
  http.get(`${baseURL}/superadmin/master-catalog/organizations`, () =>
    HttpResponse.json({
      success: true,
      data: {
        items: [{ id: 'org-pits', name: 'PITS', slug: 'pits', _count: { venues: 1 } }],
        nextCursor: null,
      },
    }),
  ),
  http.get(`${baseURL}/superadmin/master-catalog/organizations/org-pits`, () =>
    HttpResponse.json({ success: true, data: detail() }),
  ),
  http.put(
    `${baseURL}/superadmin/master-catalog/organizations/org-pits/entitlement`,
    async ({ request }) => {
      entitlementWrites += 1
      const body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({
        success: true,
        data: {
          before: null,
          after: { id: 'grant-1', ...body, createdAt: '2026-08-10T00:00:00.000Z' },
        },
      })
    },
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  entitlementWrites = 0
  server.resetHandlers()
})
afterAll(() => server.close())

describe('MasterCatalogAccessPage', () => {
  it('shows the fail-closed organization state and the operational rollout evidence', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MasterCatalogAccessPage />)

    expect(await screen.findByText('PITS')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir control de PITS' }))

    expect(await screen.findByText('Sin grant explícito')).toBeInTheDocument()
    expect(screen.getByText('Schema v1')).toBeInTheDocument()
    expect(screen.getByText('Catálogo base apagado')).toBeInTheDocument()
    expect(screen.getByText('PITS Centro')).toBeInTheDocument()
    expect(screen.getByText('TPV stale')).toBeInTheDocument()
    expect(screen.getByText('La publicación quedó stale.')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /editar (productos|precios)/i }),
    ).not.toBeInTheDocument()
  })

  it('never grants PITS automatically and shows the server before/after only after confirmation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MasterCatalogAccessPage />)
    await user.click(await screen.findByRole('button', { name: 'Abrir control de PITS' }))

    expect(entitlementWrites).toBe(0)
    await user.type(
      screen.getByRole('textbox', { name: 'Motivo del entitlement' }),
      'Contrato autorizado',
    )
    await user.click(screen.getByRole('button', { name: 'Crear grant explícito' }))
    expect(entitlementWrites).toBe(0)

    expect(
      screen.getByRole('dialog', { name: 'Confirmar cambio de entitlement' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar cambio' }))

    await waitFor(() => expect(entitlementWrites).toBe(1))
    expect(await screen.findByText('Cambio aplicado')).toBeInTheDocument()
    expect(screen.getByText('Antes')).toBeInTheDocument()
    expect(screen.getByText('Después')).toBeInTheDocument()
  })

  it('disables every write when live authority denies control-plane mutation', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/master-catalog/organizations/org-pits`, () => {
        const denied = detail()
        denied.access.canConfigureControlPlane = false
        denied.access.reasonCode = 'ROLE_DENIED'
        return HttpResponse.json({ success: true, data: denied })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<MasterCatalogAccessPage />)
    await user.click(await screen.findByRole('button', { name: 'Abrir control de PITS' }))

    expect(await screen.findByRole('button', { name: 'Crear grant explícito' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Deshabilitar módulo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled()
    expect(entitlementWrites).toBe(0)
  })
})
