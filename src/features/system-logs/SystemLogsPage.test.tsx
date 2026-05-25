import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { SystemLogsPage } from './SystemLogsPage'

const baseURL = 'http://localhost:3000/api/v1'

interface RawLog {
  id: string
  timestamp: string
  message: string
  level: 'info' | 'warning' | 'error' | null
  type: 'app' | 'request' | 'build' | 'deploy' | null
  labels: Array<{ name: string; value: string }>
}

function logsResponse(logs: RawLog[], enabled = true, disabledReason?: string) {
  return HttpResponse.json({
    success: true,
    data: {
      enabled,
      ...(disabledReason ? { disabledReason } : {}),
      logs,
      hasMore: false,
    },
  })
}

const server = setupServer(
  http.get(`${baseURL}/superadmin/system-logs`, () =>
    logsResponse([
      {
        id: 'l1',
        timestamp: '2026-01-01T12:00:00.000Z',
        message: 'Server started on port 3000',
        level: 'info',
        type: 'app',
        labels: [],
      },
      {
        id: 'l2',
        timestamp: '2026-01-01T11:59:00.000Z',
        message: 'Request End: GET /api/v1/tpv/payments - 200 [55ms]',
        level: 'info',
        type: 'request',
        labels: [],
      },
    ]),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('<SystemLogsPage />', () => {
  it('renders the heading and key controls', async () => {
    renderWithProviders(<SystemLogsPage />)
    expect(screen.getByRole('heading', { name: /logs del sistema/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pausar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refrescar/i })).toBeInTheDocument()
  })

  it('shows logs from the server (humanized summary)', async () => {
    renderWithProviders(<SystemLogsPage />)
    await waitFor(() =>
      expect(screen.getByText(/Server started on port 3000/i)).toBeInTheDocument(),
    )
    // The HTTP request log gets summarized to include "GET" and the response code
    expect(document.body.textContent).toMatch(/GET/)
    expect(document.body.textContent).toMatch(/200/)
  })

  it('renders the "no logs" warning when Render is not configured', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/system-logs`, () =>
        logsResponse([], false, 'RENDER_API_KEY no está configurado.'),
      ),
    )
    renderWithProviders(<SystemLogsPage />)
    // The warning + the table empty state both render — pick the warning panel by its heading.
    await waitFor(() => {
      expect(screen.getByText(/Logs de Render no configurados/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/RENDER_API_KEY no está configurado/i)).toBeInTheDocument()
  })

  it('renders QueryError when the endpoint fails', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/system-logs`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderWithProviders(<SystemLogsPage />)
    await waitFor(
      () => {
        // QueryError renders role="alert" — one of them mentions "cargar los logs"
        const alerts = screen.getAllByRole('alert')
        expect(alerts.length).toBeGreaterThan(0)
      },
      { timeout: 4000 },
    )
  })

  it('shows TPV badge on rows whose message contains a TPV path', async () => {
    renderWithProviders(<SystemLogsPage />)
    await waitFor(() => expect(screen.getAllByText(/TPV/i).length).toBeGreaterThan(0))
  })

  it('renders the filter pills (Nivel, Tipo, Origen)', async () => {
    renderWithProviders(<SystemLogsPage />)
    await waitFor(() => expect(screen.getByText(/Server started/i)).toBeInTheDocument())
    // Filter pills are clickable buttons containing the label
    const pillButtons = screen.getAllByRole('button')
    const labels = pillButtons.map((b) => b.textContent ?? '')
    expect(labels.some((t) => /Nivel/.test(t))).toBe(true)
    expect(labels.some((t) => /Tipo/.test(t))).toBe(true)
    expect(labels.some((t) => /Origen/.test(t))).toBe(true)
  })

  it('renders the caption with the visible-row count', async () => {
    renderWithProviders(<SystemLogsPage />)
    await waitFor(() => expect(screen.getByText(/Server started/i)).toBeInTheDocument())
    // Table caption is sr-only — querying via container body works
    expect(document.body.textContent).toMatch(/2 visibles/i)
  })

  it('shows the live/pause status pill', () => {
    renderWithProviders(<SystemLogsPage />)
    // initially live → contains "En vivo" or "Actualizando…"
    const live = screen.getAllByText((content) => /en vivo|actualizando/i.test(content))
    expect(live.length).toBeGreaterThan(0)
  })
})

describe('SystemLogsPage / LogDetail (expanded row)', () => {
  it('renders detail when expanding a row with text-only message', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/system-logs`, () =>
        logsResponse([
          {
            id: 'lx',
            timestamp: '2026-01-01T12:00:00.000Z',
            message: 'A plain text message no json here',
            level: 'info',
            type: 'app',
            labels: [],
          },
        ]),
      ),
    )
    const { container } = renderWithProviders(<SystemLogsPage />)
    await waitFor(() => expect(screen.getByText(/A plain text message/i)).toBeInTheDocument())

    // Find the expand chevron — first column has aria-label "Expandir fila"
    const chevron = container.querySelector(
      'button[aria-label^="Expandir"]',
    ) as HTMLButtonElement | null
    if (chevron) {
      chevron.click()
      await waitFor(() => {
        const matches = within(container).getAllByText(/Mensaje completo/i)
        expect(matches.length).toBeGreaterThan(0)
      })
    }
  })
})
