import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { BlumonSetupPanel } from './BlumonSetupPanel'
import { buildBlumonPayload, INITIAL_DRAFT } from './blumon-setup'

describe('buildBlumonPayload', () => {
  it('convierte tasas decimal → porcentaje', () => {
    const draft = {
      ...INITIAL_DRAFT,
      venueId: 'v1',
      serialNumber: '2841',
      displayName: 'Cuenta',
      cost: { DEBIT: 0.025, CREDIT: 0.03, AMEX: 0.035, INTERNATIONAL: 0.04 },
    }
    const body = buildBlumonPayload(draft)
    expect(body.costStructureOverrides?.debitRate).toBe(2.5)
    expect(body.target).toEqual({ type: 'venue', id: 'v1' })
    expect(body.settlementConfig?.amexDays).toBe(3)
  })

  it('omite cost/pricing cuando no se llenaron', () => {
    const body = buildBlumonPayload({
      ...INITIAL_DRAFT,
      venueId: 'v1',
      serialNumber: '2841',
      displayName: 'C',
    })
    expect(body.costStructureOverrides).toBeUndefined()
    expect(body.venuePricing).toBeUndefined()
  })
})

describe('BlumonSetupPanel', () => {
  it('renderiza el panel con su título y las 9 cards', () => {
    renderWithProviders(<BlumonSetupPanel />)
    expect(screen.getByText('Nuevo merchant Blumon')).toBeInTheDocument()
    expect(screen.getByText('Venue')).toBeInTheDocument()
    expect(screen.getByText('Terminal Blumon')).toBeInTheDocument()
    expect(screen.getByText('Reparto de ganancias')).toBeInTheDocument()
    // CTA arranca deshabilitado (faltan obligatorias)
    expect(screen.getByRole('button', { name: /Crear merchant/ })).toBeDisabled()
  })
})
