import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EarningsKpis } from './EarningsKpis'
import type { EarningsTotals } from './types'

const totals: EarningsTotals = {
  netProfit: 33.94,
  terminalNet: 33.94,
  onlineFees: 0,
  tramoProvider: 834.52,
  tramoAggregator: -800.58,
  aggregatorKept: 0,
  volume: 109474.3,
  transactions: 254,
  averageMargin: 0.0003,
}

describe('EarningsKpis', () => {
  it('shows net profit (not the gross spread) and the two tramos', () => {
    render(<EarningsKpis totals={totals} />)
    expect(screen.getByText('Ganancia neta (Avoqado)')).toBeInTheDocument()
    expect(screen.getAllByText('$33.94').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Prov→agg/)).toBeInTheDocument()
    expect(screen.getByText(/\$834\.52/)).toBeInTheDocument()
    expect(screen.getByText(/-\$800\.58/)).toBeInTheDocument()
    expect(screen.getByText('254 transacciones')).toBeInTheDocument()
  })
})
