import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/render'
import { VenueDetailPage } from './VenueDetailPage'

const baseURL = 'http://localhost:3000/api/v1'

const rawVenue = {
  id: 'v1',
  name: 'Restaurante Pez Volador',
  slug: 'pez-volador',
  status: 'ACTIVE' as const,
  monthlyRevenue: 12000,
  totalTransactions: 0,
  organizationId: 'org1',
  organization: {
    id: 'org1',
    name: 'Grupo Pez Volador',
    email: 'grupo@pez.mx',
    phone: '+52 55 0000 1111',
  },
  owner: {
    id: 's1',
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan@pez.mx',
    phone: '+52 55 9999 0000',
  },
  analytics: {
    monthlyTransactions: 12,
    monthlyRevenue: 12000,
    averageOrderValue: 1000,
    activeUsers: 1,
    lastActivityAt: '2026-05-01T00:00:00.000Z',
  },
  kycStatus: 'VERIFIED',
  statusChangedAt: '2026-02-01T00:00:00.000Z',
  suspensionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderAtVenue(venueId: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/venues/:venueId" element={<VenueDetailPage />} />
    </Routes>,
    { initialEntries: [`/venues/${venueId}`] },
  )
}

describe('VenueDetailPage', () => {
  it('muestra el detalle de un venue existente', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues/v1`, () =>
        HttpResponse.json({ success: true, data: rawVenue }),
      ),
      // La sección Plan pide su estado a un namespace aparte (no superadmin).
      http.get(`${baseURL}/dashboard/venues/v1/plan`, () =>
        HttpResponse.json({
          success: true,
          data: {
            hasPlan: true,
            state: 'active',
            planTier: 'PRO',
            planName: 'Plan Pro',
            interval: 'month',
            price: { base: 999, gross: 1158.84, currency: 'MXN' },
            trialEndsAt: null,
            currentPeriodEnd: '2026-07-01T00:00:00.000Z',
            cancelAtPeriodEnd: false,
            paymentMethod: null,
            stripeSubscriptionId: 'sub_123',
            grandfathered: false,
            retentionOfferEligible: false,
          },
        }),
      ),
    )
    renderAtVenue('v1')
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /pez volador/i })).toBeInTheDocument(),
    )
    // Sección Owner
    expect(screen.getByText('Owner principal')).toBeInTheDocument()
    // Sección Actividad
    expect(screen.getByText('Actividad del mes en curso')).toBeInTheDocument()
    // Sección Identidad
    expect(screen.getByText('Identidad')).toBeInTheDocument()
    // Sección Plan (plan-admin del superadmin)
    expect(await screen.findByRole('heading', { level: 2, name: 'Plan' })).toBeInTheDocument()
    expect(await screen.findByText('Pro')).toBeInTheDocument()
  })

  it('muestra "Venue no encontrado" cuando el backend retorna 404', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues/missing`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    )
    renderAtVenue('missing')
    await waitFor(() => expect(screen.getByText('Venue no encontrado')).toBeInTheDocument())
  })

  it('muestra QueryError cuando el endpoint falla con 500', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues/boom`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderAtVenue('boom')
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
