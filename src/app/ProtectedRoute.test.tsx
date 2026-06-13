import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { installGlobalServer, server } from '@/test/mocks/server'

installGlobalServer()

const baseURL = 'http://localhost:3000/api/v1'

// Setting the session hint causes the AuthProvider to render a `Verificando sesión…`
// loading screen until the /auth/status query resolves — without it, the initial
// render has isAuthenticated=false and ProtectedRoute redirects immediately.
beforeEach(() => {
  window.localStorage.setItem('avoqado_session_hint', 'true')
})
afterEach(() => {
  window.localStorage.removeItem('avoqado_session_hint')
})

function renderRouted(initialPath = '/secret') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/secret"
        element={
          <ProtectedRoute>
            <p>contenido-secreto</p>
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<p>login-page</p>} />
    </Routes>,
    { initialEntries: [initialPath] },
  )
}

describe('<ProtectedRoute />', () => {
  it('redirects to /login when not authenticated', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/auth/status`, () =>
        HttpResponse.json({ authenticated: false, user: null }),
      ),
    )
    renderRouted()
    await waitFor(() => expect(screen.getByText(/login-page/i)).toBeInTheDocument())
  })

  it('renders the child when authenticated as SUPERADMIN', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/auth/status`, () =>
        HttpResponse.json({
          authenticated: true,
          user: {
            id: 'u1',
            firstName: 'Ada',
            lastName: 'L',
            email: 'ada@avoqado.io',
            photoUrl: null,
            role: 'SUPERADMIN',
            venues: [],
          },
        }),
      ),
    )
    renderRouted()
    await waitFor(() => expect(screen.getByText(/contenido-secreto/i)).toBeInTheDocument())
  })

  it('shows the "acceso denegado" screen for a non-superadmin', async () => {
    server.use(
      http.get(`${baseURL}/dashboard/auth/status`, () =>
        HttpResponse.json({
          authenticated: true,
          user: {
            id: 'u1',
            firstName: 'Roy',
            lastName: 'O',
            email: 'roy@avoqado.io',
            photoUrl: null,
            role: 'MANAGER',
            venues: [{ id: 'v1', name: 'V', slug: 'v', logo: null, role: 'MANAGER' }],
          },
        }),
      ),
    )
    renderRouted()
    await waitFor(() => expect(screen.getByText(/acceso denegado/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument()
  })
})
