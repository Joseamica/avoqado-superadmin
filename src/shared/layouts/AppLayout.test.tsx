import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { AppLayout } from './AppLayout'
import { Route, Routes } from 'react-router-dom'
import { installGlobalServer, server } from '@/test/mocks/server'

installGlobalServer()

// Stub the realtime hook to avoid spinning up sockets in jsdom.
vi.mock('@/features/realtime/use-realtime-invalidation', () => ({
  useRealtimeInvalidation: () => {},
}))

// cmdk inside CommandPalette uses ResizeObserver and scrollIntoView.
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

beforeEach(() => {
  // Override the default unauth response from the global handlers.
  server.use(
    http.get(`${baseURL}/dashboard/auth/status`, () =>
      HttpResponse.json({
        authenticated: true,
        user: {
          id: 'u1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@avoqado.io',
          photoUrl: null,
          role: 'SUPERADMIN',
          venues: [],
        },
      }),
    ),
  )
})

function renderWithRoutes(path = '/dashboard') {
  return renderWithProviders(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<p>main-content</p>} />
        <Route path="/activity-log" element={<p>activity-content</p>} />
      </Route>
    </Routes>,
    { initialEntries: [path] },
  )
}

describe('<AppLayout />', () => {
  it('renders the outlet content', async () => {
    renderWithRoutes('/dashboard')
    await waitFor(() => expect(screen.getByText(/main-content/i)).toBeInTheDocument())
  })

  it('renders the navigation groups', async () => {
    renderWithRoutes()
    // Group eyebrows
    expect(screen.getByText(/Operación/i)).toBeInTheDocument()
    expect(screen.getByText(/Catálogo/i)).toBeInTheDocument()
    expect(screen.getByText(/Configuración/i)).toBeInTheDocument()
  })

  it('renders the nav links for Resumen / Activity log / Logs del sistema', async () => {
    renderWithRoutes()
    // Wait for the layout to render. NavLink uses `to`.
    await waitFor(() => {
      const links = screen.getAllByRole('link')
      const labels = links.map((l) => l.textContent ?? '')
      expect(labels.some((t) => /resumen/i.test(t))).toBe(true)
      expect(labels.some((t) => /activity log/i.test(t))).toBe(true)
      expect(labels.some((t) => /logs del sistema/i.test(t))).toBe(true)
    })
  })

  it('shows the disabled "Pronto" badge on the KYC link', async () => {
    renderWithRoutes()
    await waitFor(() => {
      const prontoBadges = screen.getAllByText(/pronto/i)
      expect(prontoBadges.length).toBeGreaterThan(0)
    })
  })

  it('renders the search/command-palette trigger button', async () => {
    renderWithRoutes()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /abrir paleta de comandos/i })).toBeInTheDocument()
    })
  })

  it('shows the user name in the footer when authenticated', async () => {
    renderWithRoutes()
    await waitFor(() => {
      expect(screen.getByText(/Ada Lovelace/i)).toBeInTheDocument()
      expect(screen.getByText(/ada@avoqado\.io/i)).toBeInTheDocument()
    })
  })

  it('renders the cerrar-sesión button', async () => {
    renderWithRoutes()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument(),
    )
  })
})
