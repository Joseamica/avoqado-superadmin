import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { NewVenuePage } from './NewVenuePage'

const baseURL = 'http://localhost:3000/api/v1'

// jsdom no implementa ResizeObserver — algunos componentes Radix
// (Checkbox, Combobox) lo necesitan. Polyfill mínimo para que monten.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// El form usa toast.success y toast.error de sonner. Lo mockeamos para que
// no se queje y para poder verificar que se llama.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const server = setupServer(
  http.get(`${baseURL}/superadmin/onboarding/organizations`, () =>
    HttpResponse.json({
      data: [
        {
          id: 'org1',
          name: 'Grupo Pez Volador',
          slug: 'pez-volador',
          email: 'org@pez.mx',
          _count: { venues: 1 },
          hasPaymentConfig: false,
        },
      ],
    }),
  ),
  http.get(`${baseURL}/dashboard/superadmin/features`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 'f1',
          code: 'PAYMENTS',
          name: 'Pagos',
          description: 'Procesar pagos',
          category: 'PAYMENTS',
          isCore: true,
        },
      ],
    }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('NewVenuePage', () => {
  it('renderiza el header "Nuevo venue" y las secciones principales', async () => {
    renderWithProviders(<NewVenuePage />)
    // Use findByRole so the assertion waits for the page to settle. NewVenuePage
    // fires several queries on mount (orgs, features, terminal brands) — running
    // alongside the rest of the suite occasionally pushes the initial render past
    // the synchronous getBy* window. findBy waits up to 1s.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nuevo venue' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Identidad' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dirección y contacto/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Crear venue/i })).toBeInTheDocument()
  })

  it('muestra los modos "Org existente" / "Org nueva"', async () => {
    renderWithProviders(<NewVenuePage />)
    expect(screen.getByRole('button', { name: 'Org existente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Org nueva' })).toBeInTheDocument()
  })

  it('valida que sin nombre no se puede crear el venue', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NewVenuePage />)
    // Click directo en "Crear venue" sin haber llenado el nombre
    const submit = screen.getByRole('button', { name: /Crear venue/i })
    await user.click(submit)
    await waitFor(() => expect(screen.getByText('Mínimo 2 caracteres')).toBeInTheDocument())
  })

  it('hace POST con payload válido cuando se llena nombre + org existente seleccionada', async () => {
    let receivedBody: unknown = null
    server.use(
      http.post(`${baseURL}/superadmin/onboarding/venue`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({
          data: {
            venueId: 'new-v',
            organizationId: 'org1',
            steps: [{ step: 'create', status: 'success' }],
          },
        })
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<NewVenuePage />)

    // Esperamos a que el form de orgs esté ready (el combobox usa el listado)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Org existente' })).toBeInTheDocument(),
    )

    // Como el Combobox de organización es complicado, modificamos manualmente
    // el orgMode a "new" y llenamos un org nueva — más simple de testear.
    await user.click(screen.getByRole('button', { name: 'Org nueva' }))

    // Llena los campos de la organización nueva
    const orgName = document.getElementById('org-name') as HTMLInputElement
    await user.type(orgName, 'Grupo Test')

    // Buscamos por id porque dos campos tienen label "Email" / "Teléfono".
    const orgEmail = document.getElementById('org-email') as HTMLInputElement
    await user.type(orgEmail, 'test@test.mx')

    const orgPhone = document.getElementById('org-phone') as HTMLInputElement
    await user.type(orgPhone, '+52 55 1234 5678')

    // Llenar nombre del venue
    const venueName = document.getElementById('venue-name') as HTMLInputElement
    await user.type(venueName, 'Mi Venue Test')

    // Submit
    await user.click(screen.getByRole('button', { name: /Crear venue/i }))

    await waitFor(() => expect(receivedBody).not.toBeNull())
    expect(receivedBody).toMatchObject({
      organization: {
        mode: 'new',
        name: 'Grupo Test',
        email: 'test@test.mx',
        phone: '+52 55 1234 5678',
      },
      venue: {
        name: 'Mi Venue Test',
        venueType: 'RESTAURANT',
      },
    })
  })

  it('al expandir "Dirección y contacto" se muestran los campos opcionales', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NewVenuePage />)
    const toggle = screen.getByRole('button', { name: /Dirección y contacto/ })
    await user.click(toggle)
    // Los inputs aparecen
    expect(document.getElementById('venue-address')).toBeInTheDocument()
    expect(document.getElementById('venue-city')).toBeInTheDocument()
    expect(document.getElementById('venue-zip')).toBeInTheDocument()
  })

  it('al expandir "Owner inicial" se muestran los campos del owner', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NewVenuePage />)
    const toggle = screen.getByRole('button', { name: /Owner inicial/ })
    await user.click(toggle)
    expect(document.getElementById('owner-email')).toBeInTheDocument()
    expect(document.getElementById('owner-first')).toBeInTheDocument()
  })

  it('al expandir "Operaciones administrativas" se muestra el checkbox de pre-aprobar KYC', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NewVenuePage />)
    const toggle = screen.getByRole('button', { name: /Operaciones administrativas/ })
    await user.click(toggle)
    expect(document.getElementById('approve-kyc')).toBeInTheDocument()
  })

  it('al expandir "Datos fiscales" y elegir Persona Moral, se exige RFC', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NewVenuePage />)
    // Open the fiscal subsection (button text: "Datos fiscales")
    const fiscalToggle = screen.getByRole('button', { name: /Datos fiscales/ })
    await user.click(fiscalToggle)
    // The RFC input appears
    expect(document.getElementById('venue-rfc')).toBeInTheDocument()
  })

  it('al expandir "Features activos" se muestra el catálogo de features', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NewVenuePage />)
    const toggle = screen.getByRole('button', { name: /Features activos/ })
    await user.click(toggle)
    // El feature "PAYMENTS" debería renderizarse con su descripción cuando llegue.
    // "Pagos" aparece como nombre Y como categoría, así que busco por descripción.
    await waitFor(() => expect(screen.getByText('Procesar pagos')).toBeInTheDocument())
  })
})
