import { it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HybridCampaignsPage } from './HybridCampaignsPage'
const change = vi.fn(),
  list = vi.fn()
const campaign = {
  id: 'campaign',
  code: 'ELECCION',
  name: 'Campaña de otoño',
  slug: 'otono',
  status: 'PAUSED',
  revision: 2,
  startsAt: '2026-10-01T06:00:00Z',
  endsAt: '2026-12-01T06:00:00Z',
  capacity: 80,
  redeemedCount: 3,
  reservedCount: 2,
  audience: 'ALL',
  eligibleOrganizationIds: [],
  listed: true,
  draftDefinition: {
    schemaVersion: 1,
    kind: 'CHOICE_BUNDLE',
    choiceCount: 4,
    eligibleFeatureCodes: ['A', 'B', 'C', 'D'],
    terms: {
      currency: 'MXN',
      interval: 'MONTHLY',
      price: 799,
      taxIncluded: true,
      promotionCycles: 3,
      renewal: { kind: 'REPRICE', price: 999 },
    },
  },
  publications: [{ id: 'publication', version: 1 }],
}
vi.mock('./hybrid-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hybrid-api')>()),
  fetchHybridCampaigns: (...args: unknown[]) => list(...args),
  fetchHybridCampaign: async () => campaign,
  changeHybridStatus: (...args: unknown[]) => change(...args),
}))
beforeAll(() =>
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
)
afterAll(() => vi.unstubAllGlobals())
it('searches the server and shows total pagination; activation requires reviewing the exact campaign', async () => {
  const user = userEvent.setup()
  list.mockResolvedValue({ items: [campaign], total: 80, page: 1, pageSize: 25 })
  change.mockResolvedValue({ ...campaign, status: 'ACTIVE' })
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <HybridCampaignsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByRole('button', { name: 'Ver Campaña de otoño' })
  expect(screen.getByText(/80 campañas/)).toBeInTheDocument()
  await user.type(screen.getByPlaceholderText('Buscar campañas'), 'otono')
  await waitFor(() =>
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'otono', page: 1, pageSize: 25 }),
    ),
  )
  await user.click(await screen.findByRole('button', { name: 'Ver Campaña de otoño' }))
  await user.click(await screen.findByRole('button', { name: 'Activar ventas' }))
  expect(change).not.toHaveBeenCalled()
  const confirmation = screen.getByRole('region', { name: 'Confirmación de estado' })
  const redemptions = screen.getByRole('heading', { name: 'Contrataciones y lugares reservados' })
  expect(
    confirmation.compareDocumentPosition(redemptions) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Confirmar activación' }))
  await waitFor(() => expect(change).toHaveBeenCalledWith(campaign, 'ACTIVE'))
})
