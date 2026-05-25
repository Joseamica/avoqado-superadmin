import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/render'
import { VenueResourcePlaceholder } from './VenueResourcePlaceholder'

const baseURL = 'http://localhost:3000/api/v1'

const rawVenue = {
  id: 'v1',
  name: 'Pez Volador',
  slug: 'pez-volador',
  status: 'ACTIVE' as const,
  monthlyRevenue: 0,
  totalTransactions: 0,
  organizationId: 'org1',
  organization: { id: 'org1', name: 'Grupo Pez', email: 'org@pez.mx' },
  owner: { id: 's1', firstName: 'Juan', lastName: 'Pérez', email: 'juan@pez.mx' },
  analytics: {
    monthlyTransactions: 0,
    monthlyRevenue: 0,
    averageOrderValue: 0,
    activeUsers: 0,
    lastActivityAt: '2026-05-01T00:00:00.000Z',
  },
  kycStatus: 'NOT_SUBMITTED',
  statusChangedAt: null,
  suspensionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

const server = setupServer(
  http.get(`${baseURL}/dashboard/superadmin/venues/v1`, () =>
    HttpResponse.json({ success: true, data: rawVenue }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderResource(resource: 'owner' | 'kyc' | 'terminal' | 'merchant' | 'pricing') {
  return renderWithProviders(
    <Routes>
      <Route path="/venues/:venueId/x" element={<VenueResourcePlaceholder resource={resource} />} />
    </Routes>,
    { initialEntries: ['/venues/v1/x'] },
  )
}

describe('VenueResourcePlaceholder', () => {
  it('muestra la acción correcta para "owner"', async () => {
    renderResource('owner')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Asignar owner al venue' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText(/Pez Volador/).length).toBeGreaterThan(0))
  })

  it('muestra la acción correcta para "kyc"', () => {
    renderResource('kyc')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Subir documentos KYC' }),
    ).toBeInTheDocument()
  })

  it('muestra la acción correcta para "terminal"', () => {
    renderResource('terminal')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Asignar terminal al venue' }),
    ).toBeInTheDocument()
  })

  it('muestra la acción correcta para "merchant"', () => {
    renderResource('merchant')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Vincular merchant account' }),
    ).toBeInTheDocument()
  })

  it('muestra la acción correcta para "pricing"', () => {
    renderResource('pricing')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Configurar comisiones' }),
    ).toBeInTheDocument()
  })

  it('muestra "Próximamente" en cualquier resource', () => {
    renderResource('owner')
    expect(screen.getByText('Próximamente')).toBeInTheDocument()
  })

  it('cuando no hay venueId en la URL, muestra mensaje de URL inválida', () => {
    renderWithProviders(
      <Routes>
        <Route path="/x" element={<VenueResourcePlaceholder resource="owner" />} />
      </Routes>,
      { initialEntries: ['/x'] },
    )
    expect(screen.getByText('Falta venueId en la URL.')).toBeInTheDocument()
  })

  it('muestra QueryError cuando el backend devuelve 500', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues/v1`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderResource('owner')
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
