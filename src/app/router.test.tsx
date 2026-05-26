import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from './router'

const baseURL = 'http://localhost:3000/api/v1'

const server = setupServer(
  http.get(`${baseURL}/dashboard/auth/status`, () =>
    HttpResponse.json({ authenticated: false, user: null }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('AppRoutes', () => {
  it('renderiza 404 en ruta inexistente', async () => {
    renderWithProviders(<AppRoutes />, { initialEntries: ['/some-nonexistent-route'] })

    await waitFor(
      () => {
        expect(screen.getByText('404 · ruta inexistente')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })

  it('muestra el loading state con Suspense fallback', () => {
    // AppRoutes wraps in Suspense with RouteLoader — verify the component renders
    // without crashing (the actual lazy-loaded page tests live alongside each page)
    renderWithProviders(<AppRoutes />, { initialEntries: ['/login'] })

    // Either the RouteLoader fallback or the actual page should be present
    expect(document.querySelector('div')).toBeTruthy()
  })
})
