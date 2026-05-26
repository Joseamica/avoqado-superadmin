import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EarningsKpis } from './EarningsKpis'
import type { EarningsTotals } from './types'

const totals: EarningsTotals = {
  grossProfit: 128450.2,
  terminalProfit: 119800,
  onlineFees: 8650.2,
  volume: 4200000,
  transactions: 18204,
  averageMargin: 0.0306,
}

describe('EarningsKpis', () => {
  it('shows total profit and the terminal/online split', () => {
    render(<EarningsKpis totals={totals} />)
    expect(screen.getByText('$128,450.20')).toBeInTheDocument()
    expect(screen.getByText(/Terminales/)).toBeInTheDocument()
    expect(screen.getByText(/En línea/)).toBeInTheDocument()
    expect(screen.getByText('3.06%')).toBeInTheDocument()
    expect(screen.getByText('18,204')).toBeInTheDocument()
  })
})
