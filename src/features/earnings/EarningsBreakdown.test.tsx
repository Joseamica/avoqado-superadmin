import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EarningsBreakdown } from './EarningsBreakdown'
import type { EarningsSummary } from './types'

const summary: EarningsSummary = {
  range: { startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-31T00:00:00.000Z' },
  totals: {
    netProfit: 0,
    terminalNet: 0,
    onlineFees: 0,
    tramoProvider: 0,
    tramoAggregator: 0,
    aggregatorKept: 0,
    volume: 0,
    transactions: 0,
    averageMargin: 0,
  },
  byVenue: [
    {
      venueId: 'v1',
      venueName: 'Amaena',
      netProfit: 36400,
      terminalNet: 36000,
      onlineFees: 400,
      volume: 1200000,
      transactions: 5120,
    },
  ],
  byMerchant: [
    {
      merchantAccountId: 'm1',
      label: 'Cuenta Principal',
      providerCode: 'MENTA',
      hasAggregator: true,
      netProfit: 100,
      tramoProvider: 80,
      tramoAggregator: 20,
      volume: 1000,
      transactions: 10,
    },
  ],
  byProvider: [
    {
      providerId: 'p1',
      providerCode: 'MENTA',
      providerName: 'Menta',
      volume: 1000,
      netProfit: 30,
      transactions: 10,
    },
  ],
  byCardType: [{ type: 'CREDIT', transactions: 10, volume: 1000, netProfit: 30 }],
  byChannel: [
    {
      ecommerceMerchantId: 'e1',
      label: 'Amaena online',
      providerCode: 'STRIPE',
      fees: 400,
      volume: 20000,
      transactions: 80,
    },
  ],
}

describe('EarningsBreakdown', () => {
  it('shows the venue tab by default and switches tabs', () => {
    render(<EarningsBreakdown summary={summary} />)
    expect(screen.getByText('Amaena')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Canal online' }))
    expect(screen.getByText('Amaena online')).toBeInTheDocument()
  })

  it('shows the two tramos in the merchant tab', () => {
    render(<EarningsBreakdown summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: 'Merchant' }))
    expect(screen.getByText('Prov→agg')).toBeInTheDocument()
    expect(screen.getByText('Agg→venue')).toBeInTheDocument()
    expect(screen.getByText('Cuenta Principal')).toBeInTheDocument()
  })
})
