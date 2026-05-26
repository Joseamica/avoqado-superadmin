import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LiquidationCalculatorDialog } from './LiquidationCalculatorDialog'
import { computeMerchantEconomics } from './economics'
import type { CardRates } from './types'

const cost: CardRates = { DEBIT: 0.0116, CREDIT: 0.0116, AMEX: 0.0116, INTERNATIONAL: 0.0116 }
const aggregatorPrice: CardRates = {
  DEBIT: 0.0348,
  CREDIT: 0.0348,
  AMEX: 0.0348,
  INTERNATIONAL: 0.0348,
}
const venuePrice: CardRates = { DEBIT: 0.1, CREDIT: 0.1, AMEX: 0.1, INTERNATIONAL: 0.1 }

const eco = computeMerchantEconomics({
  cost,
  venuePrice,
  revenueShare: {
    aggregatorPrice,
    avoqadoShareOfProviderMargin: 0.5,
    avoqadoShareOfAggregatorMargin: 1,
    taxRate: 0.16,
  },
})

describe('LiquidationCalculatorDialog', () => {
  it('escala el margen total al monto capturado', () => {
    render(
      <LiquidationCalculatorDialog
        open
        onOpenChange={() => {}}
        venueName="Amaena"
        economics={eco}
      />,
    )
    // Default $1000 → margen Avoqado total por $100 = $7.68 → ×10 = $76.80
    expect(screen.getByText('Calculadora de liquidación · Amaena')).toBeInTheDocument()
    expect(screen.getByText('+$76.80')).toBeInTheDocument()
    // Recibe el venue = 1000 − (10% de 1000 = 100) = 900
    expect(screen.getByText('$900.00')).toBeInTheDocument()
  })

  it('recalcula al cambiar el monto', () => {
    render(
      <LiquidationCalculatorDialog
        open
        onOpenChange={() => {}}
        venueName="Amaena"
        economics={eco}
      />,
    )
    fireEvent.change(screen.getByLabelText('Monto transaccionado'), { target: { value: '500' } })
    // $500 → margen total = 7.68 × 5 = $38.40
    expect(screen.getByText('+$38.40')).toBeInTheDocument()
  })
})
