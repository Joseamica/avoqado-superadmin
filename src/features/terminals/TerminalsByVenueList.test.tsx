import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { TerminalsByVenueList } from './TerminalsByVenueList'
import type { Terminal } from './types'

function makeTerminal(overrides: Partial<Terminal> = {}): Terminal {
  return {
    id: 't1',
    serialNumber: '1850072345',
    name: 'TPV Barra',
    type: 'TPV_ANDROID',
    brand: 'PAX',
    model: 'A910s',
    status: 'ACTIVE',
    lastHeartbeat: new Date(Date.now() - 60_000).toISOString(),
    version: '1.42.0',
    latestHealthScore: 80,
    latestHealthAt: null,
    ipAddress: null,
    isLocked: false,
    lockedAt: null,
    lockedReason: null,
    assignedMerchantIds: [],
    activationCode: null,
    activationCodeExpiry: null,
    activatedAt: '2026-01-01T00:00:00.000Z',
    venueId: 'v1',
    venue: { id: 'v1', name: 'Pez Volador', slug: 'pez-volador' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-05-25T10:00:00.000Z',
    ...overrides,
  }
}

describe('TerminalsByVenueList', () => {
  it('muestra estado vacío cuando no hay terminals', () => {
    renderWithProviders(<TerminalsByVenueList terminals={[]} onSelectTerminal={() => {}} />)

    expect(screen.getByText('Sin terminals que mostrar')).toBeInTheDocument()
  })

  it('agrupa terminals por su venue y los renderiza', () => {
    const terminals = [
      makeTerminal({ id: 't1', name: 'TPV Barra' }),
      makeTerminal({ id: 't2', name: 'TPV Caja' }),
      makeTerminal({
        id: 't3',
        name: 'TPV Otra',
        venueId: 'v2',
        venue: { id: 'v2', name: 'El Pulpo', slug: 'el-pulpo' },
      }),
    ]

    renderWithProviders(<TerminalsByVenueList terminals={terminals} onSelectTerminal={() => {}} />)

    expect(screen.getByText('Pez Volador')).toBeInTheDocument()
    expect(screen.getByText('El Pulpo')).toBeInTheDocument()
    expect(screen.getByText('TPV Barra')).toBeInTheDocument()
    expect(screen.getByText('TPV Caja')).toBeInTheDocument()
    expect(screen.getByText('TPV Otra')).toBeInTheDocument()
  })

  it('invoca onSelectTerminal cuando se click un row', () => {
    let selected: Terminal | null = null
    const terminals = [makeTerminal({ name: 'TPV Barra' })]

    renderWithProviders(
      <TerminalsByVenueList
        terminals={terminals}
        onSelectTerminal={(t) => {
          selected = t
        }}
      />,
    )

    fireEvent.click(screen.getByText('TPV Barra'))
    expect(selected).not.toBeNull()
    expect(selected!.name).toBe('TPV Barra')
  })

  it('ordena venues con más terminals sin activar primero', () => {
    const terminals = [
      // Venue Apple: 1 terminal activa
      makeTerminal({
        id: 't1',
        venueId: 'vA',
        venue: { id: 'vA', name: 'Apple', slug: 'apple' },
      }),
      // Venue Beta: 1 sin activar
      makeTerminal({
        id: 't2',
        venueId: 'vB',
        venue: { id: 'vB', name: 'Beta', slug: 'beta' },
        status: 'PENDING_ACTIVATION',
        activatedAt: null,
      }),
    ]

    renderWithProviders(<TerminalsByVenueList terminals={terminals} onSelectTerminal={() => {}} />)

    const headings = screen.getAllByRole('heading', { level: 2 })
    // Beta (con pending) debe aparecer antes que Apple
    expect(headings[0].textContent).toContain('Beta')
    expect(headings[1].textContent).toContain('Apple')
  })

  it('permite collapse/expand de un grupo', () => {
    const terminals = [makeTerminal({ name: 'TPV Barra' })]

    renderWithProviders(<TerminalsByVenueList terminals={terminals} onSelectTerminal={() => {}} />)

    expect(screen.getByText('TPV Barra')).toBeInTheDocument()

    // Botón de toggle (aria-expanded=true)
    const toggle = screen.getByRole('button', { expanded: true })
    fireEvent.click(toggle)

    // Después del click, la lista debería estar oculta
    expect(screen.queryByText('TPV Barra')).not.toBeInTheDocument()
  })
})
