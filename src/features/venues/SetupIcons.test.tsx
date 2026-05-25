import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { TooltipProvider } from '@/shared/ui/Tooltip'
import { SetupCounter, SetupIcons } from './SetupIcons'
import type { Venue } from './types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Pez Volador',
    slug: 'pez-volador',
    status: 'ACTIVE',
    kycStatus: 'VERIFIED',
    monthlyRevenue: 0,
    monthlyTransactions: 0,
    averageOrderValue: 0,
    organizationId: 'org1',
    organization: { id: 'org1', name: 'Grupo Pez', email: 'org@pez.mx' },
    owner: { id: 's1', firstName: 'Juan', lastName: 'Pérez', email: 'juan@pez.mx' },
    statusChangedAt: null,
    suspensionReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function render(ui: React.ReactElement) {
  return renderWithProviders(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('SetupIcons', () => {
  it('renderiza 5 iconos (uno por flag)', () => {
    const venue = makeVenue({
      completeness: {
        hasOwner: true,
        hasTerminal: true,
        hasMerchantAccount: true,
        hasKycDocs: true,
        hasPricing: true,
        kycVerified: true,
      },
    })
    render(<SetupIcons venue={venue} />)
    // Hay un <ul> con aria-label que envuelve los iconos, cada <li> uno
    const list = screen.getByLabelText(/setup del venue/i)
    expect(list).toBeInTheDocument()
    expect(list.querySelectorAll('li')).toHaveLength(5)
  })

  it('cuando un flag es false, el link de ese icono apunta al subpath de configuración', () => {
    const venue = makeVenue({
      completeness: {
        hasOwner: false,
        hasTerminal: true,
        hasMerchantAccount: true,
        hasKycDocs: true,
        hasPricing: true,
        kycVerified: true,
      },
    })
    render(<SetupIcons venue={venue} />)
    // El icono "missing" tiene aria-label con la descripción del missing
    const ownerLink = screen.getByLabelText(/falta staff con rol owner/i)
    expect(ownerLink).toHaveAttribute('href', '/venues/v1/owner')
  })

  it('cuando un flag es true, el link apunta al detalle del venue', () => {
    const venue = makeVenue({
      completeness: {
        hasOwner: true,
        hasTerminal: true,
        hasMerchantAccount: true,
        hasKycDocs: true,
        hasPricing: true,
        kycVerified: true,
      },
    })
    render(<SetupIcons venue={venue} />)
    const ownerLink = screen.getByLabelText(/owner asignado/i)
    expect(ownerLink).toHaveAttribute('href', '/venues/v1')
  })

  it('cuando completeness no existe, los 5 iconos quedan en estado unknown', () => {
    const venue = makeVenue({ completeness: undefined })
    render(<SetupIcons venue={venue} />)
    // Cada uno debería describirse como "desconocido"
    const unknowns = screen.getAllByLabelText(/desconocido|antiguo/i)
    expect(unknowns.length).toBe(5)
  })
})

describe('SetupCounter', () => {
  it('muestra "0/5" cuando ningún flag está OK', () => {
    const venue = makeVenue({
      completeness: {
        hasOwner: false,
        hasTerminal: false,
        hasMerchantAccount: false,
        hasKycDocs: false,
        hasPricing: false,
        kycVerified: false,
      },
    })
    render(<SetupCounter venue={venue} />)
    expect(screen.getByText('0/5')).toBeInTheDocument()
  })

  it('muestra "5/5" cuando todo está OK', () => {
    const venue = makeVenue({
      completeness: {
        hasOwner: true,
        hasTerminal: true,
        hasMerchantAccount: true,
        hasKycDocs: true,
        hasPricing: true,
        kycVerified: true,
      },
    })
    render(<SetupCounter venue={venue} />)
    expect(screen.getByText('5/5')).toBeInTheDocument()
  })

  it('muestra el placeholder "?" cuando completeness está ausente', () => {
    const venue = makeVenue({ completeness: undefined })
    render(<SetupCounter venue={venue} />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
