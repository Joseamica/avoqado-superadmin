import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EconomicsTable } from './EconomicsTable'
import { computeMerchantEconomics } from './economics'

describe('EconomicsTable', () => {
  it('renderiza fila de margen para el modo all-avoqado', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: { DEBIT: 0.02, CREDIT: 0.03, AMEX: 0.04, INTERNATIONAL: 0.045 },
      revenueShare: null,
    })
    render(<EconomicsTable economics={eco} />)
    expect(screen.getByText('Margen Avoqado')).toBeInTheDocument()
    expect(screen.getByText('Paga el venue')).toBeInTheDocument()
  })
})
