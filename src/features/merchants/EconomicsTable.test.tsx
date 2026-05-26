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

  it('modo aggregator a nivel merchant (sin venuePrice): margen único, sin desglose', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: null,
      revenueShare: {
        aggregatorPrice: { DEBIT: 0.02, CREDIT: 0.03, AMEX: 0.04, INTERNATIONAL: 0.045 },
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: 1,
        taxRate: 0.16,
      },
    })
    render(<EconomicsTable economics={eco} />)
    expect(screen.getByText('Precio a agregador')).toBeInTheDocument()
    expect(screen.getByText('Margen Avoqado')).toBeInTheDocument()
    expect(screen.queryByText('Paga el venue')).not.toBeInTheDocument()
    expect(screen.queryByText('Margen Avoqado (agregador)')).not.toBeInTheDocument()
  })

  it('modo aggregator por venue (con venuePrice): desglosa los dos tramos', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: { DEBIT: 0.03, CREDIT: 0.05, AMEX: 0.06, INTERNATIONAL: 0.07 },
      revenueShare: {
        aggregatorPrice: { DEBIT: 0.02, CREDIT: 0.03, AMEX: 0.04, INTERNATIONAL: 0.045 },
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: 1,
        taxRate: 0.16,
      },
    })
    render(<EconomicsTable economics={eco} />)
    expect(screen.getByText('Precio a agregador')).toBeInTheDocument()
    expect(screen.getByText('Paga el venue')).toBeInTheDocument()
    expect(screen.getByText('Cobra el agregador')).toBeInTheDocument()
    expect(screen.getByText('Margen Avoqado (proveedor)')).toBeInTheDocument()
    expect(screen.getByText('Margen Avoqado (agregador)')).toBeInTheDocument()
    expect(screen.getByText('Margen Avoqado total')).toBeInTheDocument()
  })
})
