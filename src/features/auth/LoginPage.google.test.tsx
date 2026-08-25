import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { installGlobalServer, server } from '@/test/mocks/server'
import { LoginPage } from './LoginPage'

installGlobalServer()

const baseURL = 'http://localhost:3000/api/v1'

const superadminUser = {
  id: 'usr_superadmin',
  firstName: 'José',
  lastName: 'Amieva',
  email: 'jose@avoqado.io',
  photoUrl: null,
  role: 'SUPERADMIN' as const,
  venues: [],
}

const staffUser = {
  ...superadminUser,
  id: 'usr_staff',
  email: 'mesero@venue.com',
  role: 'STAFF' as const,
  venues: [
    {
      id: 'venue_1',
      name: 'Testarudo Cafe',
      slug: 'testarudo',
      logo: null,
      role: 'STAFF' as const,
    },
  ],
}

/**
 * GIS no existe en jsdom. Sembramos `window.google` ANTES de montar: el hook
 * detecta que `accounts.id` ya está disponible y resuelve sin inyectar el
 * `<script>` (que en jsdom nunca dispararía `load`).
 */
type GisCallback = (response: { credential?: string }) => void

let gisCallback: GisCallback | null = null
const renderButton = vi.fn()

function installGoogleIdentityMock() {
  gisCallback = null
  renderButton.mockClear()
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn((config: { callback: GisCallback }) => {
          gisCallback = config.callback
        }),
        renderButton,
        cancel: vi.fn(),
        disableAutoSelect: vi.fn(),
      },
    },
  }
}

describe('<LoginPage /> — acceso con Google', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete window.google
    gisCallback = null
  })

  describe('sin VITE_GOOGLE_CLIENT_ID', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
      installGoogleIdentityMock()
    })

    it('no muestra la sección de Google — un botón sin client ID no puede funcionar', async () => {
      renderWithProviders(<LoginPage />)
      await screen.findByRole('button', { name: /entrar a la consola/i })
      expect(screen.queryByRole('region', { name: /acceso con google/i })).not.toBeInTheDocument()
      expect(renderButton).not.toHaveBeenCalled()
    })
  })

  describe('con VITE_GOOGLE_CLIENT_ID', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-de-prueba.apps.googleusercontent.com')
      installGoogleIdentityMock()
    })

    it('le pide a Google que renderice su botón en la página', async () => {
      renderWithProviders(<LoginPage />)
      expect(await screen.findByRole('region', { name: /acceso con google/i })).toBeInTheDocument()
      await waitFor(() => expect(renderButton).toHaveBeenCalled())
    })

    it('manda el credential al backend y entra cuando la cuenta es superadmin', async () => {
      const credentials: string[] = []
      server.use(
        http.post(`${baseURL}/dashboard/auth/google/one-tap`, async ({ request }) => {
          const body = (await request.json()) as { credential?: string }
          credentials.push(body?.credential ?? '')
          return HttpResponse.json({
            success: true,
            message: 'Login successful',
            user: superadminUser,
            isNewUser: false,
          })
        }),
        http.get(`${baseURL}/dashboard/auth/status`, () =>
          HttpResponse.json({ authenticated: true, user: superadminUser }),
        ),
      )

      renderWithProviders(<LoginPage />)
      await waitFor(() => expect(gisCallback).not.toBeNull())

      gisCallback?.({ credential: 'id-token-de-google' })

      await waitFor(() => expect(credentials).toEqual(['id-token-de-google']))
      // Entró: no hay mensaje de acceso denegado.
      await waitFor(() =>
        expect(screen.queryByText(/no tiene permisos de superadmin/i)).not.toBeInTheDocument(),
      )
    })

    it('cierra la sesión y explica el rechazo cuando la cuenta NO es superadmin', async () => {
      let logoutCalls = 0
      server.use(
        http.post(`${baseURL}/dashboard/auth/google/one-tap`, () =>
          HttpResponse.json({
            success: true,
            message: 'Login successful',
            user: staffUser,
            isNewUser: false,
          }),
        ),
        http.get(`${baseURL}/dashboard/auth/status`, () =>
          HttpResponse.json({ authenticated: true, user: staffUser }),
        ),
        http.post(`${baseURL}/dashboard/auth/logout`, () => {
          logoutCalls += 1
          return HttpResponse.json({ message: 'ok' })
        }),
      )

      renderWithProviders(<LoginPage />)
      await waitFor(() => expect(gisCallback).not.toBeNull())

      gisCallback?.({ credential: 'id-token-de-un-mesero' })

      expect(await screen.findByRole('alert')).toHaveTextContent(/no tiene permisos de superadmin/i)
      await waitFor(() => expect(logoutCalls).toBe(1))
    })

    it('no rompe cuando Google devuelve una respuesta sin credential', async () => {
      let oneTapCalls = 0
      server.use(
        http.post(`${baseURL}/dashboard/auth/google/one-tap`, () => {
          oneTapCalls += 1
          return HttpResponse.json({ message: 'no debería llegar aquí' }, { status: 500 })
        }),
      )

      renderWithProviders(<LoginPage />)
      await waitFor(() => expect(gisCallback).not.toBeNull())

      gisCallback?.({})

      await waitFor(() => expect(renderButton).toHaveBeenCalled())
      expect(oneTapCalls).toBe(0)
    })
  })
})
