import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EconomicsTable } from './EconomicsTable'
import { computeMerchantEconomics } from './economics'

describe('EconomicsTable', () => {
  it('muestra el manejo separado y descuenta antes de repartir el margen', () => {
    const rates = (n: number) => ({ DEBIT: n, CREDIT: n, AMEX: n, INTERNATIONAL: n })
    const economics = computeMerchantEconomics({
      cost: rates(0.007424),
      venuePrice: rates(0.055),
      revenueShare: {
        aggregatorPrice: rates(0.00812),
        intermediaryFeeRate: 0.01,
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: 1,
        taxRate: 0.16,
      },
    })
    render(<EconomicsTable economics={economics} />)
    expect(screen.getByText('Manejo del intermediario')).toBeInTheDocument()
    expect(screen.getAllByText('-$0.99')).toHaveLength(4)
    expect(screen.getAllByText('$3.70')).toHaveLength(8)
    expect(screen.getAllByText('$3.73')).toHaveLength(4)
  })

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

  it('directo a nivel merchant (sin agregador, sin venuePrice): nota, no filas vacías', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.0064, CREDIT: 0.0064, AMEX: 0.028, INTERNATIONAL: 0.0325 },
      venuePrice: null,
      revenueShare: {
        aggregatorPrice: null,
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: null,
        taxRate: 0.16,
      },
    })
    render(<EconomicsTable economics={eco} />)
    expect(screen.getByText('Costo del proveedor')).toBeInTheDocument()
    // No deben aparecer filas vacías de "Paga el venue" ni "Margen Avoqado".
    expect(screen.queryByText('Paga el venue')).not.toBeInTheDocument()
    expect(screen.queryByText('Margen Avoqado')).not.toBeInTheDocument()
    expect(screen.getByText(/El margen depende del pricing de cada venue/)).toBeInTheDocument()
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
