import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { NewTerminalPage } from './NewTerminalPage'

// Radix / cmdk popover usan ResizeObserver y scrollIntoView; jsdom no los trae.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

const baseURL = 'http://localhost:3000/api/v1'

const sampleVenue = {
  id: 'v1',
  name: 'Pez Volador',
  slug: 'pez-volador',
  status: 'ACTIVE',
  monthlyRevenue: 0,
  totalTransactions: 0,
  organizationId: 'o1',
  organization: { id: 'o1', name: 'Avoqado', email: 'org@avoqado.io' },
  owner: { id: 'u1', firstName: 'José', lastName: 'Amieva', email: 'jose@avoqado.io' },
  analytics: {
    monthlyTransactions: 0,
    monthlyRevenue: 0,
    averageOrderValue: 0,
    activeUsers: 0,
    lastActivityAt: '2026-01-01T00:00:00.000Z',
  },
  kycStatus: 'VERIFIED',
  statusChangedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-05-25T10:00:00.000Z',
}

const server = setupServer(
  http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
    HttpResponse.json({ success: true, data: [sampleVenue] }),
  ),
  http.get(`${baseURL}/superadmin/onboarding/merchant-accounts`, () =>
    HttpResponse.json({ data: [] }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('NewTerminalPage', () => {
  it('renderiza el título "Registrar terminal"', async () => {
    renderWithProviders(<NewTerminalPage />)
    expect(screen.getByRole('heading', { name: 'Registrar terminal' })).toBeInTheDocument()
  })

  it('muestra las secciones del formulario', async () => {
    renderWithProviders(<NewTerminalPage />)
    expect(screen.getByText('Esencial')).toBeInTheDocument()
    expect(screen.getByText('Activación')).toBeInTheDocument()
    expect(screen.getByText('Hardware (opcional)')).toBeInTheDocument()
  })

  it('muestra las tres opciones de activación', async () => {
    renderWithProviders(<NewTerminalPage />)
    expect(screen.getByText(/Generar código para técnico/)).toBeInTheDocument()
    expect(screen.getByText(/Activar ahora — sin código/)).toBeInTheDocument()
    expect(screen.getByText(/Pendiente — registrar sin activar/)).toBeInTheDocument()
  })

  it('muestra el input de nombre interno', async () => {
    renderWithProviders(<NewTerminalPage />)
    expect(screen.getByPlaceholderText('TPV Barra')).toBeInTheDocument()
  })

  it('muestra el botón submit con label dependiente del mode activo', async () => {
    renderWithProviders(<NewTerminalPage />)
    // Default mode es 'with-code'
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Crear y generar código/ })).toBeInTheDocument(),
    )
  })

  it('muestra link de "Cancelar" hacia /terminals', async () => {
    renderWithProviders(<NewTerminalPage />)
    const cancelLink = screen.getByRole('link', { name: 'Cancelar' })
    expect(cancelLink).toHaveAttribute('href', '/terminals')
  })

  it('puede cambiar el modo de activación al hacer click en otra opción', async () => {
    renderWithProviders(<NewTerminalPage />)

    // Click "Pendiente — registrar sin activar"
    fireEvent.click(screen.getByText(/Pendiente — registrar sin activar/))

    // El submit label cambia a "Crear terminal" (modo pending)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Crear terminal' })).toBeInTheDocument(),
    )

    // Cambiar a "activate-now"
    fireEvent.click(screen.getByText(/Activar ahora — sin código/))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Crear y activar' })).toBeInTheDocument(),
    )
  })

  it('expande la sección de Hardware al hacer click', async () => {
    renderWithProviders(<NewTerminalPage />)

    // Hardware está colapsado por default
    expect(screen.queryByPlaceholderText('A910s')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Hardware (opcional)'))

    await waitFor(() => expect(screen.getByPlaceholderText('A910s')).toBeInTheDocument())
  })

  it('muestra errores de validación al intentar submit sin campos requeridos', async () => {
    renderWithProviders(<NewTerminalPage />)

    fireEvent.click(screen.getByRole('button', { name: /Crear y generar código/ }))

    // Errores deben aparecer (texto en español del componente)
    await waitFor(() => expect(screen.getByText('Nombre requerido')).toBeInTheDocument())
    expect(screen.getByText(/Selecciona el venue/)).toBeInTheDocument()
  })

  it('muestra "Volver al venue" cuando venueId está pre-llenado', async () => {
    renderWithProviders(<NewTerminalPage />, {
      initialEntries: ['/terminals/new?venueId=v1'],
    })

    await waitFor(() => expect(screen.getByText('Volver al venue')).toBeInTheDocument())
  })

  it('expande la sección de merchant accounts y muestra opciones', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/onboarding/merchant-accounts`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'm1',
              displayName: 'Cuenta Principal',
              alias: null,
              externalMerchantId: '9814275',
              provider: { name: 'Blumon' },
            },
          ],
        }),
      ),
    )

    renderWithProviders(<NewTerminalPage />)

    await waitFor(() =>
      expect(screen.getByText('Merchant accounts (opcional)')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByText('Merchant accounts (opcional)'))

    await waitFor(() => expect(screen.getByText('Cuenta Principal')).toBeInTheDocument())
  })

  it('muestra mensaje cuando no hay merchant accounts disponibles', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/onboarding/merchant-accounts`, () =>
        HttpResponse.json({ data: [] }),
      ),
    )

    renderWithProviders(<NewTerminalPage />)

    fireEvent.click(screen.getByText('Merchant accounts (opcional)'))

    await waitFor(() =>
      expect(screen.getByText(/No hay merchant accounts disponibles/)).toBeInTheDocument(),
    )
  })

  it('persiste el cambio de nombre en el form', async () => {
    renderWithProviders(<NewTerminalPage />)

    const nameInput = screen.getByPlaceholderText('TPV Barra') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'TPV Caja Principal' } })
    expect(nameInput.value).toBe('TPV Caja Principal')

    const serialInput = screen.getByPlaceholderText(/ej\. 1850072345/) as HTMLInputElement
    fireEvent.change(serialInput, { target: { value: '1850072345' } })
    expect(serialInput.value).toBe('1850072345')
  })
})
