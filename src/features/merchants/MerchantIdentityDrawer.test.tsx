import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { MerchantIdentityDrawer } from './MerchantIdentityDrawer'

const baseURL = 'http://localhost:3000/api/v1'

// Minimal MSW server for this test file.
// `onUnhandledRequest: 'bypass'` so the global MSW server from setup.ts
// (which handles auth/status) still responds without errors here.
const server = setupServer(
  http.get(`${baseURL}/superadmin/payment-providers`, () => HttpResponse.json({ data: [] })),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('MerchantIdentityDrawer — create mode', () => {
  it('renders the "Alta manual de cuenta" title when open with no merchant', async () => {
    renderWithProviders(<MerchantIdentityDrawer open onOpenChange={() => {}} />)

    await waitFor(() => expect(screen.getByText('Alta manual de cuenta')).toBeInTheDocument())
  })

  it('renders the "ID externo del merchant" input', async () => {
    renderWithProviders(<MerchantIdentityDrawer open onOpenChange={() => {}} />)

    await waitFor(() =>
      expect(screen.getByLabelText('ID externo del merchant')).toBeInTheDocument(),
    )
  })

  it('shows a validation error and does NOT fire a POST when submitting empty fields', async () => {
    let postCalled = false
    server.use(
      http.post(`${baseURL}/superadmin/merchant-accounts`, () => {
        postCalled = true
        return HttpResponse.json({ data: {} }, { status: 201 })
      }),
    )

    renderWithProviders(<MerchantIdentityDrawer open onOpenChange={() => {}} />)

    // Wait for the drawer to be fully rendered
    await waitFor(() => expect(screen.getByText('Alta manual de cuenta')).toBeInTheDocument())

    // Click the submit button without filling any field
    const submitBtn = screen.getByRole('button', { name: 'Crear cuenta' })
    fireEvent.click(submitBtn)

    // Validation error should appear (role="alert")
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    // No HTTP request should have been fired
    expect(postCalled).toBe(false)
  })
})

describe('MerchantIdentityDrawer — edit mode', () => {
  const mockMerchant = {
    id: 'm1',
    provider: { id: 'p1', code: 'BLUMON', name: 'Blumon', type: 'PAYMENT_PROCESSOR' as const },
    externalMerchantId: '9814275',
    alias: null,
    displayName: 'Cuenta Principal',
    active: true,
    displayOrder: 0,
    clabeNumber: null,
    bankName: null,
    accountHolder: null,
    hasCredentials: true,
    blumonSerialNumber: null,
    blumonPosId: null,
    blumonEnvironment: null,
    blumonMerchantId: null,
    angelpayAffiliation: null,
    angelpayMerchantName: null,
    aggregatorId: null,
    venues: [],
    terminals: [],
    counts: { costStructures: 0, venueConfigs: 0, terminals: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('renders the "Editar identidad" title and prefills externalMerchantId', async () => {
    renderWithProviders(
      <MerchantIdentityDrawer open onOpenChange={() => {}} merchant={mockMerchant} />,
    )

    await waitFor(() => expect(screen.getByText('Editar identidad')).toBeInTheDocument())

    const extIdInput = screen.getByLabelText('ID externo del merchant')
    expect(extIdInput).toHaveValue('9814275')
  })

  it('does NOT show the Credenciales fieldset in edit mode', async () => {
    renderWithProviders(
      <MerchantIdentityDrawer open onOpenChange={() => {}} merchant={mockMerchant} />,
    )

    await waitFor(() => expect(screen.getByText('Editar identidad')).toBeInTheDocument())

    expect(screen.queryByText('Credenciales')).not.toBeInTheDocument()
  })
})
