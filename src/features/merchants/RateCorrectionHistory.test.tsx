import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { RateCorrectionHistory } from './RateCorrectionHistory'

const baseURL = 'http://localhost:3000/api/v1'

const appliedBatch = {
  id: 'batch-applied',
  venueId: 'v1',
  merchantAccountId: 'ma1',
  accountType: 'PRIMARY',
  status: 'APPLIED',
  paymentCount: 4,
  costCreatedCount: 0,
  estimatedImpact: 12.5,
  appliedAt: '2026-05-20T10:00:00.000Z',
  reversedAt: null,
  createdAt: '2026-05-20T09:00:00.000Z',
}

const reversedBatch = {
  id: 'batch-reversed',
  venueId: 'v1',
  merchantAccountId: 'ma1',
  accountType: 'PRIMARY',
  status: 'REVERSED',
  paymentCount: 2,
  costCreatedCount: 0,
  estimatedImpact: -8,
  appliedAt: '2026-05-18T10:00:00.000Z',
  reversedAt: '2026-05-19T10:00:00.000Z',
  createdAt: '2026-05-18T09:00:00.000Z',
}

const otherMerchantBatch = {
  ...appliedBatch,
  id: 'batch-other',
  merchantAccountId: 'ma-other',
}

const venues = [{ id: 'v1', name: 'Café Test' }]

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('RateCorrectionHistory', () => {
  it('muestra el nombre del venue, pagos y badges de estado para los batches del merchant', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/rate-corrections`, () =>
        HttpResponse.json({ data: [appliedBatch, reversedBatch, otherMerchantBatch] }),
      ),
    )

    renderWithProviders(<RateCorrectionHistory merchantAccountId="ma1" venues={venues} />)

    // Venue name appears (twice: one per batch)
    await waitFor(() => expect(screen.getAllByText('Café Test')).toHaveLength(2))

    // Payment counts
    expect(screen.getByText('4 pagos')).toBeInTheDocument()
    expect(screen.getByText('2 pagos')).toBeInTheDocument()

    // Status badges — only for ma1's batches
    expect(screen.getByText('Aplicada')).toBeInTheDocument()
    expect(screen.getByText('Revertida')).toBeInTheDocument()

    // "Deshacer" only for the APPLIED row (not REVERSED)
    const deshacerButtons = screen.getAllByRole('button', { name: 'Deshacer' })
    expect(deshacerButtons).toHaveLength(1)

    // The other-merchant batch must not appear
    expect(screen.queryByText('batch-other')).not.toBeInTheDocument()
  })

  it('confirma y llama al endpoint de reversal al hacer clic en Sí', async () => {
    let reverseCalled = false
    server.use(
      http.get(`${baseURL}/superadmin/rate-corrections`, () =>
        HttpResponse.json({ data: [appliedBatch] }),
      ),
      http.post(`${baseURL}/superadmin/rate-corrections/batch-applied/reverse`, () => {
        reverseCalled = true
        return HttpResponse.json({ data: { ...appliedBatch, status: 'REVERSED' } })
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<RateCorrectionHistory merchantAccountId="ma1" venues={venues} />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument(),
    )

    // First click shows inline confirmation
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(await screen.findByText('¿Confirmar?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sí' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()

    // Confirm
    await user.click(screen.getByRole('button', { name: 'Sí' }))
    await waitFor(() => expect(reverseCalled).toBe(true))
  })

  it('cancela la confirmación al hacer clic en No', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/rate-corrections`, () =>
        HttpResponse.json({ data: [appliedBatch] }),
      ),
    )

    const user = userEvent.setup()
    renderWithProviders(<RateCorrectionHistory merchantAccountId="ma1" venues={venues} />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(await screen.findByText('¿Confirmar?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'No' }))
    // Confirmation UI gone, Deshacer is back
    await waitFor(() => expect(screen.queryByText('¿Confirmar?')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument()
  })

  it('muestra el empty state cuando no hay correcciones para el merchant', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/rate-corrections`, () => HttpResponse.json({ data: [] })),
    )

    renderWithProviders(<RateCorrectionHistory merchantAccountId="ma1" venues={venues} />)

    expect(
      await screen.findByText(/No hay correcciones de tasa para este merchant/i),
    ).toBeInTheDocument()
  })

  it('muestra el empty state cuando todos los batches pertenecen a otro merchant', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/rate-corrections`, () =>
        HttpResponse.json({ data: [otherMerchantBatch] }),
      ),
    )

    renderWithProviders(<RateCorrectionHistory merchantAccountId="ma1" venues={venues} />)

    expect(
      await screen.findByText(/No hay correcciones de tasa para este merchant/i),
    ).toBeInTheDocument()
  })
})
