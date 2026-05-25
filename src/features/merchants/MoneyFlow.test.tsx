import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MoneyFlow } from './MoneyFlow'
import { computeMerchantEconomics } from './economics'

describe('MoneyFlow', () => {
  it('explica el caso no-pricing', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: null,
      revenueShare: null,
    })
    render(<MoneyFlow economics={eco} />)
    expect(screen.getByText('Flujo de dinero')).toBeInTheDocument()
    expect(screen.getByText(/no podemos calcular margen/i)).toBeInTheDocument()
  })
})
