import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { TooltipProvider } from '@/shared/ui/Tooltip'
import { PaymentProviderFormPage } from './PaymentProviderFormPage'

const baseURL = 'http://localhost:3000/api/v1'

const server = setupServer(
  http.get(`${baseURL}/dashboard/auth/status`, () =>
    HttpResponse.json({
      authenticated: true,
      user: {
        id: 'u1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@avoqado.io',
        photoUrl: null,
        venues: [
          {
            id: 'v1',
            name: 'HQ',
            slug: 'hq',
            logo: null,
            role: 'SUPERADMIN',
            timezone: 'America/Mexico_City',
          },
        ],
      },
    }),
  ),
  http.get(`${baseURL}/superadmin/payment-providers`, () =>
    HttpResponse.json({ success: true, data: [] }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderForm(initialEntries: string[] = ['/payment-providers/new']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <TooltipProvider delayDuration={0}>
          <AuthProvider>
            <Routes>
              <Route path="/payment-providers/new" element={<PaymentProviderFormPage />} />
              <Route path="/payment-providers/:id" element={<PaymentProviderFormPage />} />
            </Routes>
          </AuthProvider>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PaymentProviderFormPage', () => {
  it('renderiza el modo creación con template picker', async () => {
    renderForm(['/payment-providers/new'])

    await waitFor(
      () => {
        expect(screen.getByText('Blumon')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )

    expect(screen.getByText('AngelPay')).toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  it('muestra los templates de Stripe y Menta', async () => {
    renderForm(['/payment-providers/new'])

    await waitFor(
      () => {
        expect(screen.getByText('Stripe')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )

    expect(screen.getByText('Menta')).toBeInTheDocument()
  })
})
