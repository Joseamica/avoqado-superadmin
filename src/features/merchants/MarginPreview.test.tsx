import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarginPreview } from './MarginPreview'
import { computeMerchantEconomics } from './economics'

describe('MarginPreview', () => {
  it('muestra el margen por tarjeta en modo all-avoqado', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: { DEBIT: 0.02, CREDIT: 0.03, AMEX: 0.04, INTERNATIONAL: 0.045 },
      revenueShare: null,
    })
    render(<MarginPreview economics={eco} />)
    expect(screen.getByText('Margen Avoqado (por $100)')).toBeInTheDocument()
    // All 4 card margins are 0.5 at reference amount; verify at least one appears
    expect(screen.getAllByText('$0.50').length).toBeGreaterThan(0)
  })

  it('explica que falta pricing en no-pricing', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: null,
      revenueShare: null,
    })
    render(<MarginPreview economics={eco} />)
    expect(screen.getByText(/define el pricing/i)).toBeInTheDocument()
  })

  it('en agregador a nivel merchant avisa que falta el tramo agregador→venue', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: null, // nivel merchant → sin pricing de venue
      revenueShare: {
        aggregatorPrice: { DEBIT: 0.02, CREDIT: 0.03, AMEX: 0.04, INTERNATIONAL: 0.045 },
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: 1,
        taxRate: 0.16,
      },
    })
    render(<MarginPreview economics={eco} />)
    expect(screen.getByText(/proveedor→agregador/)).toBeInTheDocument()
    expect(screen.getByText(/Falta el tramo agregador→venue/)).toBeInTheDocument()
  })
})
