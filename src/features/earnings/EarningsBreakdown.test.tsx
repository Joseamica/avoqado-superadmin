import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EarningsBreakdown } from './EarningsBreakdown'
import type { EarningsSummary } from './types'

const summary: EarningsSummary = {
  range: { startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-31T00:00:00.000Z' },
  totals: {
    grossProfit: 0,
    terminalProfit: 0,
    onlineFees: 0,
    volume: 0,
    transactions: 0,
    averageMargin: 0,
  },
  byVenue: [
    {
      venueId: 'v1',
      venueName: 'Amaena',
      profit: 36400,
      terminalProfit: 36000,
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
      profit: 100,
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
      cost: 30,
      transactions: 10,
    },
  ],
  byCardType: [{ type: 'CREDIT', transactions: 10, volume: 1000, profit: 30, margin: 0.03 }],
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
})
