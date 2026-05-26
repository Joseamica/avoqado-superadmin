import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MoneyFlowDiagram } from './MoneyFlowDiagram'
import { computeMerchantEconomics } from './economics'
import type { CardRates } from './types'

const cost: CardRates = { DEBIT: 0.0116, CREDIT: 0.0116, AMEX: 0.0116, INTERNATIONAL: 0.0116 }
const aggregatorPrice: CardRates = {
  DEBIT: 0.0348,
  CREDIT: 0.0348,
  AMEX: 0.0348,
  INTERNATIONAL: 0.0348,
}

describe('MoneyFlowDiagram', () => {
  it('flujo completo por venue: muestra las 4 entidades y el total con los dos tramos', () => {
    const eco = computeMerchantEconomics({
      cost,
      venuePrice: { DEBIT: 0.1, CREDIT: 0.1, AMEX: 0.1, INTERNATIONAL: 0.1 },
      revenueShare: {
        aggregatorPrice,
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: 1,
        taxRate: 0.16,
      },
    })
    render(<MoneyFlowDiagram economics={eco} shares={{ provider: 0.5, aggregator: 1 }} />)
    // Arranca colapsado: se abre con un click.
    expect(screen.queryByText('Proveedor')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Flujo del dinero/ }))
    expect(screen.getByText('Proveedor')).toBeInTheDocument()
    expect(screen.getByText('Avoqado')).toBeInTheDocument()
    expect(screen.getByText('Agregador')).toBeInTheDocument()
    expect(screen.getByText('Venue')).toBeInTheDocument()
    expect(screen.getByText('Avoqado se queda')).toBeInTheDocument()
    // m1 (3.48−1.16=2.32)×50% + m2 (10−3.48=6.52)×100% = 1.16 + 6.52 = 7.68
    expect(screen.getByText('$7.68')).toBeInTheDocument()
  })

  it('a nivel merchant (sin venuePrice) deja el venue pendiente y avisa que falta el tramo', () => {
    const eco = computeMerchantEconomics({
      cost,
      venuePrice: null,
      revenueShare: {
        aggregatorPrice,
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: 1,
        taxRate: 0.16,
      },
    })
    render(<MoneyFlowDiagram economics={eco} shares={{ provider: 0.5, aggregator: 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: /Flujo del dinero/ }))
    expect(screen.getByText('Agregador')).toBeInTheDocument()
    expect(screen.getByText(/el cobro al venue es por venue/i)).toBeInTheDocument()
    expect(screen.getByText('Avoqado (proveedor→agregador)')).toBeInTheDocument()
    expect(screen.getByText(/Falta el tramo agregador→venue/i)).toBeInTheDocument()
  })

  it('directo (sin agregador): Proveedor → Avoqado → Venue', () => {
    const eco = computeMerchantEconomics({
      cost,
      venuePrice: { DEBIT: 0.05, CREDIT: 0.05, AMEX: 0.05, INTERNATIONAL: 0.05 },
      revenueShare: null,
    })
    render(<MoneyFlowDiagram economics={eco} />)
    fireEvent.click(screen.getByRole('button', { name: /Flujo del dinero/ }))
    expect(screen.getByText('Proveedor')).toBeInTheDocument()
    expect(screen.getByText('Venue')).toBeInTheDocument()
    expect(screen.queryByText('Agregador')).not.toBeInTheDocument()
  })
})
