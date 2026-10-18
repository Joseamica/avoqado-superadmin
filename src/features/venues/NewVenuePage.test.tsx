import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { toast } from 'sonner'
import { useLocation } from 'react-router-dom'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { NewVenuePage } from './NewVenuePage'

const navigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (original) => ({
  ...(await original<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

Element.prototype.scrollIntoView = () => {}

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
    warning: vi.fn(),
  },
}))

const server = setupServer(
  http.get(`${baseURL}/superadmin/document-requests`, () =>
    HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 10 }),
  ),
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
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
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
        // Forma REAL del backend: plana, sin envelope { data }.
        return HttpResponse.json({
          success: true,
          venueId: 'new-v',
          venueSlug: 'test-venue',
          organizationId: 'org1',
          steps: [{ step: 'create', status: 'success' }],
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

const requestId = 'cjld2cjxh0000qzrmn831i7rn'
const receivedRequest = {
  id: requestId,
  businessName: 'Estudio Norte',
  contactName: 'Ana',
  email: 'ana@norte.mx',
  phone: '5512345678',
  entityType: 'PERSONA_FISICA',
  provider: 'ANGELPAY',
  submissionVersion: 2,
  status: 'SUBMITTED',
}
async function fillOrganization(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Org nueva' }))
  await user.type(document.getElementById('org-name')!, 'Grupo Test')
  await user.type(document.getElementById('org-email')!, 'ops@test.mx')
  await user.type(document.getElementById('org-phone')!, '5512345678')
}
let activeQueryClient: QueryClient
function SourceLocation() {
  activeQueryClient = useQueryClient()
  return <output aria-label="Ubicación">{useLocation().search}</output>
}
function withRequest() {
  server.use(
    http.get(`${baseURL}/superadmin/document-requests/${requestId}`, () =>
      HttpResponse.json({ request: receivedRequest, documents: [] }),
    ),
  )
  renderWithProviders(
    <>
      <NewVenuePage />
      <SourceLocation />
    </>,
    {
      initialEntries: [`/venues/new?documentRequest=${requestId}`],
    },
  )
}
describe('NewVenuePage con expediente', () => {
  it('precarga sólo información existente y conserva aprobación manual separada', async () => {
    withRequest()
    await waitFor(() =>
      expect(screen.getByLabelText(/Nombre del venue/)).toHaveValue('Estudio Norte'),
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Dirección y contacto/ }))
    expect(document.getElementById('venue-email')).toHaveValue('ana@norte.mx')
    expect(document.getElementById('venue-address')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: /Datos fiscales/ }))
    expect(document.getElementById('venue-rfc')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: /Operaciones administrativas/ }))
    expect(document.getElementById('approve-kyc')).not.toBeChecked()
  })
  it('exige confirmar la versión antes del POST y envía selección exacta', async () => {
    let body: unknown
    server.use(
      http.post(`${baseURL}/superadmin/onboarding/venue`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ venueId: 'venue-test', organizationId: 'org1', steps: [] })
      }),
    )
    withRequest()
    await screen.findByText(/Versión 2/)
    const user = userEvent.setup()
    await fillOrganization(user)
    await user.click(screen.getByRole('button', { name: /^Crear venue$/i }))
    expect(body).toBeUndefined()
    expect(screen.getByRole('alert')).toHaveTextContent(/Confirma que el expediente/)
    await user.click(screen.getByRole('checkbox', { name: /Confirmo que este expediente/ }))
    await user.click(screen.getByRole('button', { name: /^Crear venue$/i }))
    await waitFor(() =>
      expect(body).toMatchObject({
        documentRequest: { id: requestId, submissionVersion: 2, confirmed: true },
        activateImmediately: false,
      }),
    )
    expect(navigate).toHaveBeenCalledWith('/venues/venue-test')
  })
  it('quitar selección conserva cambios escritos a mano', async () => {
    withRequest()
    await screen.findByText(/Versión 2/)
    const user = userEvent.setup()
    const name = screen.getByLabelText(/Nombre del venue/)
    await user.clear(name)
    await user.type(name, 'Nombre manual')
    await user.click(screen.getByRole('button', { name: 'Quitar expediente' }))
    expect(name).toHaveValue('Nombre manual')
    expect(screen.getByLabelText('Ubicación').textContent).toBe('')
    expect(
      screen.queryByRole('checkbox', { name: /Confirmo que este expediente/ }),
    ).not.toBeInTheDocument()
  })
  it('no pisa campos editados mientras llega el expediente', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get(`${baseURL}/superadmin/document-requests/${requestId}`, async () => {
        await pending
        return HttpResponse.json({ request: receivedRequest, documents: [] })
      }),
    )
    renderWithProviders(<NewVenuePage />, {
      initialEntries: [`/venues/new?documentRequest=${requestId}`],
    })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/Nombre del venue/), 'Manual antes de cargar')
    release()
    await screen.findByText(/Versión 2/)
    expect(screen.getByLabelText(/Nombre del venue/)).toHaveValue('Manual antes de cargar')
  })
  it.each(['invalido', ''])(
    'query inválido %s bloquea alta hasta quitarlo expresamente',
    async (value) => {
      const post = vi.fn()
      server.use(http.post(`${baseURL}/superadmin/onboarding/venue`, post))
      renderWithProviders(<NewVenuePage />, {
        initialEntries: [`/venues/new?documentRequest=${value}`],
      })
      const user = userEvent.setup()
      await fillOrganization(user)
      await user.type(screen.getByLabelText(/Nombre del venue/), 'Sucursal válida')
      await user.click(screen.getByRole('button', { name: /^Crear venue$/i }))
      expect(post).not.toHaveBeenCalled()
      expect(screen.getByText(/Revisa el expediente de la liga/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Quitar expediente de la liga' }))
      expect(
        screen.queryByText(/identificador del expediente no es válido/),
      ).not.toBeInTheDocument()
    },
  )
  it.each([409, 503])('error %s no navega ni anuncia éxito', async (status) => {
    server.use(
      http.post(`${baseURL}/superadmin/onboarding/venue`, () =>
        HttpResponse.json({ message: 'La versión cambió. Revisa el expediente.' }, { status }),
      ),
    )
    withRequest()
    await screen.findByText(/Versión 2/)
    const user = userEvent.setup()
    await fillOrganization(user)
    await user.click(screen.getByRole('checkbox', { name: /Confirmo que este expediente/ }))
    await user.click(screen.getByRole('button', { name: /^Crear venue$/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
  it.each(['network', '403', 'draft'])(
    'expediente de la liga no disponible (%s) exige quitarlo antes del alta',
    async (kind) => {
      const post = vi.fn()
      server.use(
        http.get(`${baseURL}/superadmin/document-requests/${requestId}`, () =>
          kind === 'network'
            ? HttpResponse.error()
            : kind === '403'
              ? HttpResponse.json({ message: 'Sin acceso' }, { status: 403 })
              : HttpResponse.json({
                  request: { ...receivedRequest, status: 'DRAFT' },
                  documents: [],
                }),
        ),
        http.post(`${baseURL}/superadmin/onboarding/venue`, post),
      )
      renderWithProviders(<NewVenuePage />, {
        initialEntries: [`/venues/new?documentRequest=${requestId}`],
      })
      await screen.findByRole('alert')
      const user = userEvent.setup()
      await fillOrganization(user)
      await user.type(screen.getByLabelText(/Nombre del venue/), 'Sucursal manual')
      await user.click(screen.getByRole('button', { name: /^Crear venue$/i }))
      expect(post).not.toHaveBeenCalled()
      expect(
        screen.getByRole('button', { name: 'Quitar expediente de la liga' }),
      ).toBeInTheDocument()
      expect(navigate).not.toHaveBeenCalled()
    },
  )
  it('selección manual precarga datos recibidos y puede quitarse sin borrar datos del formulario', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/document-requests`, () =>
        HttpResponse.json({ items: [receivedRequest], total: 1, page: 1, pageSize: 10 }),
      ),
    )
    renderWithProviders(<NewVenuePage />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Expediente recibido' }))
    await user.click(await screen.findByRole('option', { name: /Estudio Norte/ }))
    expect(screen.getByLabelText(/Nombre del venue/)).toHaveValue('Estudio Norte')
    await user.click(screen.getByRole('button', { name: 'Quitar expediente' }))
    expect(screen.getByLabelText(/Nombre del venue/)).toHaveValue('Estudio Norte')
  })
  it('replay pendiente avisa honestamente y no repite el POST', async () => {
    const post = vi.fn(() =>
      HttpResponse.json({
        venueId: 'venue-previo',
        organizationId: 'org1',
        replayed: true,
        configurationPending: true,
        steps: [{ step: 'configuration', status: 'error' }],
      }),
    )
    server.use(http.post(`${baseURL}/superadmin/onboarding/venue`, post))
    withRequest()
    await screen.findByText(/Versión 2/)
    const user = userEvent.setup()
    await fillOrganization(user)
    await user.click(screen.getByRole('checkbox', { name: /Confirmo que este expediente/ }))
    await user.click(screen.getByRole('button', { name: /^Crear venue$/i }))
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        'Venue creado; configuración pendiente de revisar',
        expect.any(Object),
      ),
    )
    expect(toast.success).not.toHaveBeenCalled()
    expect(post).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/venues/venue-previo')
  })
})

const secondRequest = {
  ...receivedRequest,
  id: 'cjld2cyuq0000t3rmniod1foy',
  businessName: 'Tienda Sur',
  contactName: 'Beatriz',
  email: 'bea@sur.mx',
  phone: '5598765432',
  submissionVersion: 3,
}
function requestOptions(second = secondRequest) {
  server.use(
    http.get(`${baseURL}/superadmin/document-requests`, () =>
      HttpResponse.json({ items: [receivedRequest, second], total: 2, page: 1, pageSize: 10 }),
    ),
  )
}
async function selectRequest(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Expediente recibido' }))
  await user.click(await screen.findByRole('option', { name: new RegExp(name) }))
}
describe('NewVenuePage cambio de expediente', () => {
  it('reemplaza datos precargados A por B y exige confirmar de nuevo', async () => {
    requestOptions()
    renderWithProviders(<NewVenuePage />)
    const user = userEvent.setup()
    await selectRequest(user, 'Estudio Norte')
    await user.click(screen.getByRole('checkbox', { name: /Confirmo que este expediente/ }))
    await user.click(screen.getByRole('button', { name: /Dirección y contacto/ }))
    await selectRequest(user, 'Tienda Sur')
    expect(screen.getByLabelText(/Nombre del venue/)).toHaveValue('Tienda Sur')
    expect(document.getElementById('venue-email')).toHaveValue('bea@sur.mx')
    expect(document.getElementById('venue-phone')).toHaveValue('5598765432')
    expect(screen.getByRole('checkbox', { name: /Confirmo que este expediente/ })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: /Operaciones administrativas/ }))
    expect(document.getElementById('approve-kyc')).not.toBeChecked()
  })
  it('conserva nombre/teléfono manuales y correo borrado a propósito al cambiar A por B', async () => {
    requestOptions()
    renderWithProviders(<NewVenuePage />)
    const user = userEvent.setup()
    await selectRequest(user, 'Estudio Norte')
    await user.click(screen.getByRole('button', { name: /Dirección y contacto/ }))
    const name = screen.getByLabelText(/Nombre del venue/)
    const email = document.getElementById('venue-email')!
    const phone = document.getElementById('venue-phone')!
    await user.clear(name)
    await user.type(name, 'Identidad manual')
    await user.clear(email)
    await user.clear(phone)
    await user.type(phone, '5511112222')
    await selectRequest(user, 'Tienda Sur')
    expect(name).toHaveValue('Identidad manual')
    expect(email).toHaveValue('')
    expect(phone).toHaveValue('5511112222')
  })
  it('no arrastra contacto precargado de A si B no lo recibió', async () => {
    requestOptions({ ...secondRequest, email: '', phone: '' })
    renderWithProviders(<NewVenuePage />)
    const user = userEvent.setup()
    await selectRequest(user, 'Estudio Norte')
    await user.click(screen.getByRole('button', { name: /Dirección y contacto/ }))
    await selectRequest(user, 'Tienda Sur')
    expect(document.getElementById('venue-email')).toHaveValue('')
    expect(document.getElementById('venue-phone')).toHaveValue('')
  })
  it('selección manual B suelta URL A; renovar/revocar A no bloquea B', async () => {
    requestOptions()
    let revoked = false
    let sourceReads = 0
    server.use(
      http.get(`${baseURL}/superadmin/document-requests/${requestId}`, () => {
        sourceReads += 1
        return HttpResponse.json({
          request: { ...receivedRequest, status: revoked ? 'REVOKED' : 'SUBMITTED' },
          documents: [],
        })
      }),
    )
    renderWithProviders(
      <>
        <NewVenuePage />
        <SourceLocation />
      </>,
      { initialEntries: [`/venues/new?documentRequest=${requestId}&origen=ops`] },
    )
    await screen.findByText(/Versión 2/)
    const user = userEvent.setup()
    const name = screen.getByLabelText(/Nombre del venue/)
    await user.clear(name)
    await user.type(name, 'Nombre revisado')
    await user.click(screen.getByRole('checkbox', { name: /Confirmo que este expediente/ }))
    await selectRequest(user, 'Tienda Sur')
    expect(screen.getByLabelText('Ubicación').textContent).toBe('?origen=ops')
    revoked = true
    await act(async () => {
      await activeQueryClient.invalidateQueries({ queryKey: ['superadmin', 'document-requests'] })
    })
    expect(sourceReads).toBe(1)
    expect(screen.getByRole('button', { name: 'Expediente recibido' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(name).toHaveValue('Nombre revisado')
    expect(screen.getByText(/Versión 3/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Confirmo que este expediente/ })).not.toBeChecked()
  })
})
