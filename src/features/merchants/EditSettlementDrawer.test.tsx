import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { EditSettlementDrawer } from './EditSettlementDrawer'
import type { SettlementConfiguration } from './types'

const baseURL = 'http://localhost:3000/api/v1'

const settlements: SettlementConfiguration[] = [
  {
    id: 's1',
    merchantAccountId: 'm1',
    cardType: 'DEBIT',
    settlementDays: 1,
    settlementDayType: 'BUSINESS_DAYS',
    cutoffTime: '23:00',
    cutoffTimezone: 'America/Mexico_City',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
  },
]

let capturedPutBody: Record<string, unknown> | null = null

const server = setupServer(
  http.get(`${baseURL}/superadmin/holidays`, () => HttpResponse.json({ data: [] })),
  http.put(`${baseURL}/superadmin/settlement-configurations/s1`, async ({ request }) => {
    capturedPutBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ data: {} })
  }),
  http.post(`${baseURL}/superadmin/settlement-configurations`, () =>
    HttpResponse.json({ data: {} }, { status: 201 }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  capturedPutBody = null
})
afterAll(() => server.close())

describe('EditSettlementDrawer', () => {
  it('renders the drawer with title and card rows', () => {
    renderWithProviders(
      <EditSettlementDrawer
        open
        merchantId="m1"
        settlements={settlements}
        onOpenChange={() => {}}
      />,
    )

    expect(screen.getByText('Editar liquidación')).toBeInTheDocument()
    expect(screen.getByText('Débito')).toBeInTheDocument()
    expect(screen.getByText('Crédito')).toBeInTheDocument()
    expect(screen.getByText('AMEX')).toBeInTheDocument()
    expect(screen.getByText('Internacional')).toBeInTheDocument()
  })

  it('pre-fills the Débito input with the existing settlementDays', () => {
    renderWithProviders(
      <EditSettlementDrawer
        open
        merchantId="m1"
        settlements={settlements}
        onOpenChange={() => {}}
      />,
    )

    const debitInput = screen.getByLabelText('Días Débito') as HTMLInputElement
    expect(debitInput.value).toBe('1')
  })

  it('sends PUT with updated settlementDays when changing Débito to 2 and submitting', async () => {
    renderWithProviders(
      <EditSettlementDrawer
        open
        merchantId="m1"
        settlements={settlements}
        onOpenChange={() => {}}
      />,
    )

    // Change the Días Débito input from 1 to 2
    const debitInput = screen.getByLabelText('Días Débito')
    fireEvent.change(debitInput, { target: { value: '2' } })

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.click(submitBtn)

    // Wait for the PUT body to be captured
    await waitFor(() => {
      expect(capturedPutBody).not.toBeNull()
    })

    // Assert the captured PUT body has settlementDays === 2
    expect(capturedPutBody!.settlementDays).toBe(2)
  })
})
