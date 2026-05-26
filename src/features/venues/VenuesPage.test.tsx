import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { TooltipProvider } from '@/shared/ui/Tooltip'
import { VenuesPage } from './VenuesPage'

// jsdom no implementa ResizeObserver — algunos componentes Radix lo necesitan.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const baseURL = 'http://localhost:3000/api/v1'

const rawVenue = {
  id: 'v1',
  name: 'Restaurante Pez Volador',
  slug: 'pez-volador',
  status: 'ACTIVE' as const,
  monthlyRevenue: 12000,
  totalTransactions: 0,
  organizationId: 'org1',
  organization: {
    id: 'org1',
    name: 'Grupo Pez Volador',
    email: 'org@pez.mx',
  },
  owner: {
    id: 's1',
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan@pez.mx',
  },
  analytics: {
    monthlyTransactions: 24,
    monthlyRevenue: 12000,
    averageOrderValue: 500,
    activeUsers: 4,
    lastActivityAt: '2026-05-01T00:00:00.000Z',
  },
  kycStatus: 'VERIFIED',
  statusChangedAt: '2026-05-01T00:00:00.000Z',
  suspensionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  completeness: {
    hasOwner: true,
    hasTerminal: true,
    hasMerchantAccount: true,
    hasKycDocs: true,
    hasPricing: true,
    kycVerified: true,
  },
}

const server = setupServer(
  http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
    HttpResponse.json({ success: true, data: [rawVenue] }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderVenuesPage() {
  return renderWithProviders(
    <TooltipProvider>
      <VenuesPage />
    </TooltipProvider>,
  )
}

describe('VenuesPage', () => {
  it('renderiza el header "Venues" y el venue de la lista', async () => {
    renderVenuesPage()
    // El header H1 es estable y se ve sin esperar
    expect(screen.getByRole('heading', { name: 'Venues', level: 1 })).toBeInTheDocument()
    // El venue aparece después del fetch
    await waitFor(() => expect(screen.getByText('Restaurante Pez Volador')).toBeInTheDocument())
    expect(screen.getByText('Grupo Pez Volador')).toBeInTheDocument()
  })

  it('muestra el link "Nuevo venue" para crear uno', async () => {
    renderVenuesPage()
    expect(screen.getByRole('link', { name: /nuevo venue/i })).toBeInTheDocument()
  })

  it('muestra error con QueryError si el endpoint falla', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderVenuesPage()
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('muestra el dueño cuando inspectOwner devuelve real', async () => {
    renderVenuesPage()
    await waitFor(() => expect(screen.getByText('juan@pez.mx')).toBeInTheDocument())
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
  })

  it('muestra los KPIs con la cuenta de venues activos', async () => {
    renderVenuesPage()
    await waitFor(() => expect(screen.getByText('Restaurante Pez Volador')).toBeInTheDocument())
    // Los KPIs aparecen como sección con aria-label
    expect(screen.getByLabelText(/indicadores de venues/i)).toBeInTheDocument()
    // El total de activos contiene "1" (sólo nuestro venue)
    expect(screen.getByText('Activos')).toBeInTheDocument()
  })

  it('muestra los filtros disponibles (KYC, Vista, Agrupar)', async () => {
    renderVenuesPage()
    // Los FilterPill exponen el label como texto en su trigger.
    // "Estado" puede aparecer también en el header de columna; lo evitamos.
    expect(screen.getByText('KYC')).toBeInTheDocument()
    expect(screen.getByText('Vista')).toBeInTheDocument()
    expect(screen.getByText('Agrupar')).toBeInTheDocument()
  })

  it('muestra empty state cuando no hay venues (después del fetch)', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    )
    renderVenuesPage()
    await waitFor(() => expect(screen.getByText('Sin venues registrados')).toBeInTheDocument())
  })

  it('muestra footnote "Requieren revisión del superadmin" cuando hay KYC en cola', async () => {
    // Venue con kycStatus PENDING_REVIEW genera el focus KPI accionable
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/venues`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              ...rawVenue,
              id: 'v2',
              kycStatus: 'PENDING_REVIEW',
            },
          ],
        }),
      ),
    )
    renderVenuesPage()
    await waitFor(() =>
      expect(screen.getByText('Requieren revisión del superadmin')).toBeInTheDocument(),
    )
    // El label "KYC en cola" aparece como tile focus
    expect(screen.getByText('KYC en cola')).toBeInTheDocument()
  })

  it('muestra el placeholder del DataTable search', async () => {
    renderVenuesPage()
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/Buscar por nombre/i)).toBeInTheDocument(),
    )
  })

  it('abre el dialog de exportar CSV y descarga (invoca todos los accessors)', async () => {
    // Mockeamos createObjectURL para que jsdom no tire — el ExportDialog
    // genera un blob y descarga el archivo cuando se hace click en "Descargar".
    const createObjectURLMock = vi.fn(() => 'blob:mock')
    const revokeObjectURLMock = vi.fn()
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURLMock,
    })
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURLMock,
    })

    const user = userEvent.setup()
    renderVenuesPage()
    await waitFor(() => expect(screen.getByText('Restaurante Pez Volador')).toBeInTheDocument())
    const exportBtn = screen.getByRole('button', { name: /^exportar$/i })
    await user.click(exportBtn)
    // El dialog muestra los headers de las columnas exportables
    await waitFor(() => expect(screen.getByText('Email org')).toBeInTheDocument())
    expect(screen.getByText('Volumen mes (MXN)')).toBeInTheDocument()

    // Click en Descargar — esto invoca todas las accessor funcs del config
    const downloadBtn = screen.getByRole('button', { name: 'Descargar' })
    await user.click(downloadBtn)
    expect(createObjectURLMock).toHaveBeenCalled()
  })
})
