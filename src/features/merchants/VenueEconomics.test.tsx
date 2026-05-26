import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { VenueEconomicsSection } from './VenueEconomics'
import type { MerchantRevenueShare, MerchantVenueConfig, ProviderCostStructure } from './types'

const baseURL = 'http://localhost:3000/api/v1'

const cost: ProviderCostStructure = {
  id: 'c1',
  merchantAccountId: 'm1',
  debitRate: 0.0068,
  creditRate: 0.0068,
  amexRate: 0.028,
  internationalRate: 0.0325,
  includesTax: false,
  taxRate: 0.16,
  fixedCostPerTransaction: null,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  active: true,
}

const aggregatorShare: MerchantRevenueShare = {
  id: 'rs1',
  merchantAccountId: 'm1',
  aggregatorPrice: { DEBIT: 0.065, CREDIT: 0.065, AMEX: 0.065, INTERNATIONAL: 0.065 },
  aggregatorPriceIncludesTax: false,
  avoqadoShareOfProviderMargin: 0.5,
  avoqadoShareOfAggregatorMargin: 1, // 100% — lo que el usuario configuró
  taxRate: 0.16,
  active: true,
}

const config: MerchantVenueConfig = {
  venueId: 'v1',
  venue: { id: 'v1', name: 'Amaena', slug: 'amaena' },
  slot: 'SECONDARY',
}

const server = setupServer(
  http.get(`${baseURL}/superadmin/venue-pricing/structures/active/v1/SECONDARY`, () =>
    HttpResponse.json({
      data: {
        id: 'vp1',
        debitRate: 0.1,
        creditRate: 0.1,
        amexRate: 0.1,
        internationalRate: 0.1,
        includesTax: false,
        taxRate: 0.16,
        fixedFeePerTransaction: null,
        monthlyServiceFee: null,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
        active: true,
      },
    }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('VenueEconomicsSection', () => {
  it('desglosa los dos tramos usando el pricing del venue', async () => {
    renderWithProviders(
      <VenueEconomicsSection
        venueConfigs={[config]}
        cost={cost}
        revenueShare={aggregatorShare}
        onEditPricing={() => {}}
      />,
    )

    expect(screen.getByText('Amaena')).toBeInTheDocument()
    // Una vez resuelto el pricing del venue, aparece el desglose con el tramo agregador.
    await waitFor(() => expect(screen.getByText('Margen Avoqado (agregador)')).toBeInTheDocument())
    expect(screen.getByText('Margen Avoqado (proveedor)')).toBeInTheDocument()
    expect(screen.getByText('Margen Avoqado total')).toBeInTheDocument()
    expect(screen.getByText('Paga el venue')).toBeInTheDocument()
  })

  it('estado vacío cuando no hay venues', () => {
    renderWithProviders(
      <VenueEconomicsSection
        venueConfigs={[]}
        cost={cost}
        revenueShare={aggregatorShare}
        onEditPricing={() => {}}
      />,
    )
    expect(screen.getByText(/No está asignada a ningún venue/)).toBeInTheDocument()
  })
})
