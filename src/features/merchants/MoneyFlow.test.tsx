import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MoneyFlow } from './MoneyFlow'
import { computeMerchantEconomics } from './economics'
import type { ProviderCostStructure } from './types'

const baseCost: ProviderCostStructure = {
  id: 'c1',
  merchantAccountId: 'm1',
  debitRate: 0.015,
  creditRate: 0.025,
  amexRate: 0.035,
  internationalRate: 0.04,
  includesTax: true,
  taxRate: 0.16,
  fixedCostPerTransaction: null,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  active: true,
}

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

  it('muestra desglose comisión + IVA + total cuando hay taxRate', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: null,
      revenueShare: null,
    })
    render(<MoneyFlow economics={eco} cost={baseCost} />)
    expect(screen.getByText(/^Comisión proveedor \(\d+\.\d+%\)$/)).toBeInTheDocument()
    expect(screen.getByText(/^\+ IVA s\/comisión \(16%\)$/)).toBeInTheDocument()
    expect(screen.getByText('Total costo proveedor')).toBeInTheDocument()
  })

  it('muestra fila única sin desglose cuando taxRate es 0', () => {
    const eco = computeMerchantEconomics({
      cost: { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 },
      venuePrice: null,
      revenueShare: null,
    })
    render(<MoneyFlow economics={eco} cost={{ ...baseCost, taxRate: 0 }} />)
    expect(screen.getByText('Costo del proveedor')).toBeInTheDocument()
    expect(screen.queryByText('Comisión proveedor')).not.toBeInTheDocument()
  })
})
