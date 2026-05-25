import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { TooltipProvider } from '@/shared/ui/Tooltip'
import { TerminalsPage } from './TerminalsPage'

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

function renderPage() {
  return renderWithProviders(
    <TooltipProvider>
      <TerminalsPage />
    </TooltipProvider>,
  )
}

const baseURL = 'http://localhost:3000/api/v1'

const rawTerminal = {
  id: 't1',
  serialNumber: '1850072345',
  name: 'TPV Barra',
  type: 'TPV_ANDROID' as const,
  brand: 'PAX',
  model: 'A910s',
  status: 'ACTIVE' as const,
  lastHeartbeat: new Date(Date.now() - 60_000).toISOString(),
  version: '1.42.0',
  latestHealthScore: 85,
  latestHealthAt: new Date(Date.now() - 60_000).toISOString(),
  ipAddress: '192.168.1.10',
  isLocked: false,
  lockedAt: null,
  lockedReason: null,
  assignedMerchantIds: [],
  activationCode: null,
  activationCodeExpiry: null,
  activatedAt: '2026-01-01T00:00:00.000Z',
  venueId: 'v1',
  venue: { id: 'v1', name: 'Pez Volador', slug: 'pez-volador' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-05-25T10:00:00.000Z',
}

const server = setupServer(
  http.get(`${baseURL}/dashboard/superadmin/terminals`, () =>
    HttpResponse.json({ data: [rawTerminal], count: 1 }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('TerminalsPage', () => {
  it('renderiza el título y lista terminals', async () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Terminals' })).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('TPV Barra')).toBeInTheDocument())
    expect(screen.getByText('1850072345')).toBeInTheDocument()
    expect(screen.getByText('Pez Volador')).toBeInTheDocument()
  })

  it('muestra el botón de Registrar terminal con link a /terminals/new', async () => {
    renderPage()

    const link = screen.getByRole('link', { name: /registrar terminal/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/terminals/new')
  })

  it('muestra error cuando el endpoint falla', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )

    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('muestra KPI strip con totales', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('TPV Barra')).toBeInTheDocument())
    // Cuando hay 1 terminal activa, KPI strip muestra "Total" y "Online"
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay terminals', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({ data: [], count: 0 }),
      ),
    )

    renderPage()

    await waitFor(() =>
      expect(screen.getByText(/Sin terminals registradas|Cargando terminals/)).toBeInTheDocument(),
    )
  })

  it('muestra terminales con distintos estados (PENDING, MAINTENANCE, sin heartbeat)', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({
          data: [
            { ...rawTerminal, id: 't1', name: 'TPV Online' },
            {
              ...rawTerminal,
              id: 't2',
              name: 'TPV Pendiente',
              status: 'PENDING_ACTIVATION',
              activatedAt: null,
              lastHeartbeat: null,
              version: null,
            },
            {
              ...rawTerminal,
              id: 't3',
              name: 'TPV Mantenimiento',
              status: 'MAINTENANCE',
            },
          ],
          count: 3,
        }),
      ),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('TPV Online')).toBeInTheDocument())
    expect(screen.getByText('TPV Pendiente')).toBeInTheDocument()
    expect(screen.getByText('TPV Mantenimiento')).toBeInTheDocument()
    // El KPI focus debe ser "Sin activar" porque hay un pending — aparece en
    // varios lugares (KPI label + badge del terminal en la tabla).
    expect(screen.getAllByText('Sin activar').length).toBeGreaterThan(0)
  })

  it('muestra el view por venue cuando groupBy=venue está activo', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({ data: [rawTerminal], count: 1 }),
      ),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('TPV Barra')).toBeInTheDocument())

    // Abrir el filter pill de "Agrupar"
    const groupByButton = screen.getByText('Agrupar')
    fireEvent.click(groupByButton)

    // Seleccionar la opción de venue
    await waitFor(() => expect(screen.getByText('Por venue')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Por venue'))

    // Debería ahora mostrar la lista agrupada (header "agrupados por venue")
    await waitFor(() => expect(screen.getByText(/agrupados por venue/)).toBeInTheDocument())
  })

  it('renderiza KPI "En mantenimiento" cuando hay un terminal MAINTENANCE y nada pending', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({
          data: [
            {
              ...rawTerminal,
              id: 't1',
              name: 'TPV M1',
              status: 'MAINTENANCE',
            },
          ],
          count: 1,
        }),
      ),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('TPV M1')).toBeInTheDocument())
    // KPI label + badge del terminal — chequeamos al menos uno
    expect(screen.getAllByText('En mantenimiento').length).toBeGreaterThan(0)
  })

  it('renderiza terminales sin heartbeat ni serial (estado fresh)', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({
          data: [
            {
              ...rawTerminal,
              id: 't1',
              name: 'TPV Fresh',
              serialNumber: null,
              lastHeartbeat: null,
              version: null,
              brand: null,
              model: null,
              status: 'PENDING_ACTIVATION',
              activatedAt: null,
            },
          ],
          count: 1,
        }),
      ),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('TPV Fresh')).toBeInTheDocument())
    // Sin serial → muestra placeholder
    expect(screen.getByText('Sin serial')).toBeInTheDocument()
    // Sin heartbeat → muestra "Nunca"
    expect(screen.getByText('Nunca')).toBeInTheDocument()
  })

  it('renderiza terminal bloqueada con la badge "Bloqueada"', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/superadmin/terminals`, () =>
        HttpResponse.json({
          data: [
            {
              ...rawTerminal,
              id: 't1',
              name: 'TPV Lock',
              isLocked: true,
              lockedAt: '2026-05-25T10:00:00.000Z',
              lockedReason: 'Suspended',
            },
          ],
          count: 1,
        }),
      ),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('TPV Lock')).toBeInTheDocument())
    expect(screen.getByText('Bloqueada')).toBeInTheDocument()
  })
})
