import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('renders the cells of every tab (negocio, merchant, proveedor, tarjeta, canal)', () => {
    render(<EarningsBreakdown summary={summary} />)
    // Tab buttons share names with sortable column headers (e.g. "Proveedor"),
    // so target the tab — always the first match, rendered before the table.
    const clickTab = (name: string) => fireEvent.click(screen.getAllByRole('button', { name })[0])

    expect(screen.getByText('Amaena')).toBeInTheDocument() // venue (default)
    clickTab('Merchant')
    expect(screen.getByText('Cuenta Principal')).toBeInTheDocument()
    clickTab('Proveedor')
    expect(screen.getByText('Menta')).toBeInTheDocument()
    clickTab('Tarjeta')
    expect(screen.getByText('CREDIT')).toBeInTheDocument()
    clickTab('Canal online')
    expect(screen.getByText('Amaena online')).toBeInTheDocument()
  })
})

describe('EarningsBreakdown · CSV export per tab', () => {
  // jsdom lacks URL.createObjectURL; downloadCsv needs it.
  const origCreate = globalThis.URL.createObjectURL
  const origRevoke = globalThis.URL.revokeObjectURL
  beforeAll(() => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock') as typeof URL.createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL
  })
  afterAll(() => {
    globalThis.URL.createObjectURL = origCreate
    globalThis.URL.revokeObjectURL = origRevoke
  })

  it('exports each tab to CSV (exercises the export column accessors)', async () => {
    const user = userEvent.setup()
    render(<EarningsBreakdown summary={summary} />)

    for (const tab of ['Negocio', 'Merchant', 'Proveedor', 'Tarjeta', 'Canal online'] as const) {
      // First match = the tab (column headers share some names but render after).
      await user.click(screen.getAllByRole('button', { name: tab })[0])
      await user.click(screen.getByRole('button', { name: /Exportar/ }))
      // Dialog opens with CSV as the default format; download invokes rowsToCsv → accessors.
      await user.click(await screen.findByRole('button', { name: /Descargar/ }))
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument(),
      )
    }

    expect(globalThis.URL.createObjectURL).toHaveBeenCalled()
  })
})
