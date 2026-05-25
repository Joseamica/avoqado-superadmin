import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { TooltipProvider } from '@/shared/ui/Tooltip'
import { VenuesByOrgList } from './VenuesByOrgList'
import type { Venue } from './types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: overrides.id ?? 'v1',
    name: overrides.name ?? 'Restaurante Pez Volador',
    slug: overrides.slug ?? 'pez-volador',
    status: overrides.status ?? 'ACTIVE',
    kycStatus: overrides.kycStatus ?? 'VERIFIED',
    monthlyRevenue: overrides.monthlyRevenue ?? 12000,
    monthlyTransactions: overrides.monthlyTransactions ?? 12,
    averageOrderValue: overrides.averageOrderValue ?? 1000,
    organizationId: overrides.organizationId ?? 'org1',
    organization: overrides.organization ?? {
      id: 'org1',
      name: 'Grupo Pez Volador',
      email: 'grupo@pez.mx',
    },
    owner: overrides.owner ?? {
      id: 's1',
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan@pez.mx',
    },
    statusChangedAt: overrides.statusChangedAt ?? null,
    suspensionReason: overrides.suspensionReason ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-02T00:00:00.000Z',
    completeness: overrides.completeness,
  }
}

function render(ui: React.ReactElement) {
  return renderWithProviders(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('VenuesByOrgList', () => {
  it('muestra el empty state cuando no hay venues', () => {
    render(<VenuesByOrgList venues={[]} />)
    expect(screen.getByText('Sin organizaciones que mostrar')).toBeInTheDocument()
  })

  it('agrupa venues por organización y muestra los totales', () => {
    const venues: Venue[] = [
      makeVenue({ id: 'v1', name: 'Pez Volador', monthlyRevenue: 1000, monthlyTransactions: 5 }),
      makeVenue({
        id: 'v2',
        name: 'Pez Volador Coyoacán',
        slug: 'pez-coyoacan',
        monthlyRevenue: 2000,
        monthlyTransactions: 7,
      }),
    ]
    render(<VenuesByOrgList venues={venues} />)
    // Header de la org aparece como h2
    expect(screen.getByRole('heading', { level: 2, name: 'Grupo Pez Volador' })).toBeInTheDocument()
    // Los 2 venues están listados
    expect(screen.getByText('Pez Volador')).toBeInTheDocument()
    expect(screen.getByText('Pez Volador Coyoacán')).toBeInTheDocument()
    // Texto "2 venues" en el header del grupo
    expect(screen.getByText(/2 venues/)).toBeInTheDocument()
  })

  it('ordena grupos por revenue desc — el grupo con más volumen va arriba', () => {
    const venues: Venue[] = [
      makeVenue({
        id: 'v1',
        organizationId: 'orgA',
        organization: { id: 'orgA', name: 'Org A (poco)', email: 'a@mx' },
        monthlyRevenue: 100,
        monthlyTransactions: 1,
      }),
      makeVenue({
        id: 'v2',
        organizationId: 'orgB',
        organization: { id: 'orgB', name: 'Org B (mucho)', email: 'b@mx' },
        monthlyRevenue: 50000,
        monthlyTransactions: 30,
      }),
    ]
    render(<VenuesByOrgList venues={venues} />)
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings[0]).toHaveTextContent('Org B (mucho)')
    expect(headings[1]).toHaveTextContent('Org A (poco)')
  })

  it('muestra "sin movimiento este mes" cuando totalTransactions === 0', () => {
    const venues: Venue[] = [
      makeVenue({
        monthlyRevenue: 0,
        monthlyTransactions: 0,
      }),
    ]
    render(<VenuesByOrgList venues={venues} />)
    expect(screen.getByText(/sin movimiento este mes/i)).toBeInTheDocument()
  })
})
