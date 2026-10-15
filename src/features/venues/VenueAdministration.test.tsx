import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { renderWithProviders } from '@/test/render'
import { VenueAdministration } from './VenueAdministration'

const baseURL = 'http://localhost:3000/api/v1/superadmin/venues'
const revision = '2026-10-15T10:00:00.000Z'
const fixture = {
  venue: {
    id: 'v1',
    organizationId: 'org1',
    name: 'Tienda Centro',
    slug: 'tienda-centro',
    type: 'RETAIL_STORE',
    language: 'es',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
    phone: '5551234567',
    email: null,
    website: null,
    address: 'Calle Uno 12',
    city: 'Ciudad de México',
    state: 'CDMX',
    country: 'MX',
    zipCode: '01000',
    latitude: null,
    longitude: null,
    entityType: null,
    rfc: null,
    legalName: null,
    fiscalRegime: null,
    status: 'ACTIVE',
    kycStatus: 'VERIFIED',
    suspensionReason: null,
    updatedAt: revision,
  },
  organization: {
    id: 'org1',
    name: 'Grupo Centro',
    email: 'grupo@example.com',
    phone: '5551234567',
    taxId: null,
    billingEmail: null,
    updatedAt: revision,
    venueCount: 3,
  },
  owner: {
    id: 'staff1',
    firstName: 'Ana',
    lastName: 'López',
    email: 'ana@example.com',
    phone: null,
    updatedAt: revision,
    role: 'OWNER',
    venueCount: 2,
  },
  allowedStatusTransitions: ['ADMIN_SUSPENDED', 'CLOSED'],
}
const server = setupServer()
const patch = vi.fn()
let activeClient: QueryClient
function AdministrationWithClient() {
  activeClient = useQueryClient()
  return <VenueAdministration venueId="v1" />
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  patch.mockReset()
  server.use(
    http.get(`${baseURL}/v1/administration`, () => HttpResponse.json({ data: fixture })),
    http.patch(`${baseURL}/v1/:section`, async ({ request, params }) => {
      patch(params.section, await request.json())
      return HttpResponse.json({ data: fixture })
    }),
  )
})
afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})
afterAll(() => {
  server.close()
  vi.unstubAllGlobals()
})

async function open(section: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: `Editar ${section}` }))
  return { user, dialog: screen.getByRole('dialog') }
}

describe('VenueAdministration', () => {
  it('guarda sólo los campos cambiados con la revisión leída e invalida ficha, lista y actividad', async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    renderWithProviders(<VenueAdministration venueId="v1" />)
    const { user, dialog } = await open('datos generales')
    await user.clear(within(dialog).getByLabelText('Nombre del negocio'))
    await user.type(within(dialog).getByLabelText('Nombre del negocio'), 'Tienda Norte')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('profile', {
        expectedUpdatedAt: revision,
        changes: { name: 'Tienda Norte' },
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['superadmin', 'venues'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['superadmin', 'venue-administration'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['superadmin', 'activity-log'] })
  })

  it('envía null al vaciar un dato opcional sin borrar los omitidos', async () => {
    renderWithProviders(<VenueAdministration venueId="v1" />)
    const { user, dialog } = await open('contacto y domicilio')
    await user.clear(within(dialog).getByLabelText('Teléfono del negocio'))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('profile', {
        expectedUpdatedAt: revision,
        changes: { phone: null },
      }),
    )
  })

  it.each([409, 422, 500])('conserva el borrador ante error %s y refetch', async (status) => {
    server.use(
      http.patch(`${baseURL}/v1/profile`, () =>
        HttpResponse.json({ message: 'Hay que revisar los datos' }, { status }),
      ),
    )
    renderWithProviders(<AdministrationWithClient />)
    const { user, dialog } = await open('datos generales')
    const name = within(dialog).getByLabelText('Nombre del negocio')
    await user.clear(name)
    await user.type(name, 'Borrador conservado')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByRole('alert')
    server.use(
      http.get(`${baseURL}/v1/administration`, () =>
        HttpResponse.json({
          data: {
            ...fixture,
            venue: {
              ...fixture.venue,
              name: 'Otro operador',
              updatedAt: '2026-10-15T11:00:00.000Z',
            },
          },
        }),
      ),
    )
    await act(async () => {
      await activeClient.invalidateQueries({ queryKey: ['superadmin', 'venue-administration'] })
    })
    expect(name).toHaveValue('Borrador conservado')
    expect(within(dialog).getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('exige confirmar que los enlaces públicos dejan de funcionar al cambiar el slug', async () => {
    renderWithProviders(<VenueAdministration venueId="v1" />)
    const { user, dialog } = await open('datos generales')
    await user.clear(within(dialog).getByLabelText('Slug'))
    await user.type(within(dialog).getByLabelText('Slug'), 'tienda-norte')
    const save = within(dialog).getByRole('button', { name: 'Guardar cambios' })
    expect(save).toBeDisabled()
    await user.click(within(dialog).getByRole('checkbox', { name: /enlaces públicos anteriores/ }))
    await user.click(save)
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('profile', {
        expectedUpdatedAt: revision,
        changes: { slug: 'tienda-norte' },
        confirmSlugChange: true,
      }),
    )
  })

  it('resuelve un conflicto tras revisión explícita sin reenviar datos que el usuario no tocó', async () => {
    const freshRevision = '2026-10-15T12:00:00.000Z'
    const fresh = {
      ...fixture,
      venue: { ...fixture.venue, slug: 'otro-slug', updatedAt: freshRevision },
    }
    let attempts = 0
    server.use(
      http.patch(`${baseURL}/v1/profile`, async ({ request }) => {
        patch('profile', await request.json())
        return ++attempts === 1
          ? HttpResponse.json({ message: 'La ficha cambió' }, { status: 409 })
          : HttpResponse.json({ data: fresh })
      }),
    )
    renderWithProviders(<VenueAdministration venueId="v1" />)
    const { user, dialog } = await open('datos generales')
    await user.clear(within(dialog).getByLabelText('Nombre del negocio'))
    await user.type(within(dialog).getByLabelText('Nombre del negocio'), 'Mi nombre nuevo')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByRole('alert')
    server.use(http.get(`${baseURL}/v1/administration`, () => HttpResponse.json({ data: fresh })))
    await user.click(within(dialog).getByRole('button', { name: 'Revisar datos actuales' }))
    expect(await within(dialog).findByLabelText('Slug')).toHaveValue('otro-slug')
    expect(within(dialog).getByLabelText('Nombre del negocio')).toHaveValue('Mi nombre nuevo')
    expect(within(dialog).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await user.click(within(dialog).getByRole('checkbox', { name: /Revisé los datos actuales/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(patch).toHaveBeenLastCalledWith('profile', {
        expectedUpdatedAt: freshRevision,
        changes: { name: 'Mi nombre nuevo' },
      }),
    )
  })

  it('registra coordenadas como números', async () => {
    renderWithProviders(<VenueAdministration venueId="v1" />)
    const { user, dialog } = await open('contacto y domicilio')
    await user.type(within(dialog).getByLabelText('Latitud'), '19.43')
    await user.type(within(dialog).getByLabelText('Longitud'), '-99.13')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('profile', {
        expectedUpdatedAt: revision,
        changes: { latitude: 19.43, longitude: -99.13 },
      }),
    )
  })

  it('exige confirmar el alcance de la organización y manda su identidad y revisión', async () => {
    renderWithProviders(<VenueAdministration venueId="v1" />)
    const { user, dialog } = await open('organización')
    expect(within(dialog).getByText(/3 sucursales/)).toBeInTheDocument()
    const name = within(dialog).getByLabelText('Nombre de la organización')
    await user.clear(name)
    await user.type(name, 'Grupo Nuevo')
    const save = within(dialog).getByRole('button', { name: 'Guardar cambios' })
    expect(save).toBeDisabled()
    await user.click(within(dialog).getByRole('checkbox'))
    await user.click(save)
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('organization', {
        expectedUpdatedAt: revision,
        expectedOrganizationId: 'org1',
        confirmShared: true,
        changes: { name: 'Grupo Nuevo' },
      }),
    )
  })

  it('edita el contacto compartido del OWNER sin modificar su email de acceso', async () => {
    renderWithProviders(<VenueAdministration venueId="v1" />)
    const { user, dialog } = await open('contacto del responsable')
    expect(within(dialog).getByText(/2 sucursales/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Email de acceso')).toHaveAttribute('readonly')
    await user.type(within(dialog).getByLabelText('Teléfono del responsable'), '5550000000')
    await user.click(within(dialog).getByRole('checkbox'))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('owner', {
        expectedUpdatedAt: revision,
        expectedOwnerId: 'staff1',
        confirmShared: true,
        changes: { phone: '5550000000' },
      }),
    )
  })

  it('permite cambiar el nombre de una organización con teléfono legado vacío sin enviarlo', async () => {
    server.use(
      http.get(`${baseURL}/v1/administration`, () =>
        HttpResponse.json({
          data: {
            ...fixture,
            organization: { ...fixture.organization, phone: '' },
          },
        }),
      ),
    )
    renderWithProviders(<VenueAdministration venueId="v1" />)
    const { user, dialog } = await open('organización')
    expect(within(dialog).getByLabelText('Teléfono de la organización')).not.toBeRequired()
    await user.clear(within(dialog).getByLabelText('Nombre de la organización'))
    await user.type(within(dialog).getByLabelText('Nombre de la organización'), 'Otro grupo')
    await user.click(within(dialog).getByRole('checkbox'))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('organization', {
        expectedUpdatedAt: revision,
        expectedOrganizationId: 'org1',
        confirmShared: true,
        changes: { name: 'Otro grupo' },
      }),
    )
  })

  it('borra un dato legal opcional con null y explica su alcance fiscal', async () => {
    server.use(
      http.get(`${baseURL}/v1/administration`, () =>
        HttpResponse.json({
          data: {
            ...fixture,
            venue: { ...fixture.venue, legalName: 'Tienda Centro SA de CV' },
          },
        }),
      ),
    )
    renderWithProviders(<VenueAdministration venueId="v1" />)
    const { user, dialog } = await open('registro legal')
    expect(within(dialog).getByText(/No modifica facturas emitidas/)).toBeInTheDocument()
    await user.clear(within(dialog).getByLabelText('Razón social'))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('profile', {
        expectedUpdatedAt: revision,
        changes: { legalName: null },
      }),
    )
  })

  it('identifica al ADMIN de respaldo sin llamarlo propietario', async () => {
    server.use(
      http.get(`${baseURL}/v1/administration`, () =>
        HttpResponse.json({
          data: {
            ...fixture,
            owner: { ...fixture.owner, role: 'ADMIN' },
          },
        }),
      ),
    )
    renderWithProviders(<VenueAdministration venueId="v1" />)
    expect(await screen.findByText(/Administrador de respaldo/)).toBeInTheDocument()
    expect(screen.queryByText('Propietario (OWNER)')).not.toBeInTheDocument()
  })

  it('permite sólo transiciones vigentes y exige motivo y confirmación para suspender', async () => {
    renderWithProviders(<VenueAdministration venueId="v1" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Cambiar estado' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Nuevo estado' }))
    expect(screen.queryByRole('option', { name: 'Activo' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('option', { name: /Suspendido por Avoqado/ }))
    const save = within(dialog).getByRole('button', { name: 'Guardar cambios' })
    expect(save).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Motivo'), 'Solicitud de operaciones')
    await user.click(within(dialog).getByRole('checkbox'))
    await user.click(save)
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('status', {
        expectedUpdatedAt: revision,
        status: 'ADMIN_SUSPENDED',
        reason: 'Solicitud de operaciones',
      }),
    )
  })

  it('no conserva el editor de un venue al cambiar la ruta', async () => {
    const { rerender } = renderWithProviders(<VenueAdministration venueId="v1" />)
    const { user, dialog } = await open('datos generales')
    await user.type(within(dialog).getByLabelText('Nombre del negocio'), ' borrador')
    server.use(
      http.get(`${baseURL}/v2/administration`, () =>
        HttpResponse.json({
          data: {
            ...fixture,
            venue: { ...fixture.venue, id: 'v2' },
          },
        }),
      ),
    )
    rerender(<VenueAdministration venueId="v2" />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(patch).not.toHaveBeenCalled()
  })

  it('presenta errores de lectura con QueryError y permite reintentar', async () => {
    server.use(
      http.get(`${baseURL}/v1/administration`, () =>
        HttpResponse.json({ message: 'Falla temporal' }, { status: 500 }),
      ),
    )
    renderWithProviders(<VenueAdministration venueId="v1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor (500)')
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument()
  })

  it('no acepta la revisión vieja si falla cargar datos actuales tras un conflicto', async () => {
    server.use(
      http.patch(`${baseURL}/v1/profile`, () =>
        HttpResponse.json({ message: 'La ficha cambió' }, { status: 409 }),
      ),
    )
    renderWithProviders(<VenueAdministration venueId="v1" />)
    const { user, dialog } = await open('datos generales')
    await user.type(within(dialog).getByLabelText('Nombre del negocio'), ' nuevo')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByRole('alert')
    server.use(
      http.get(`${baseURL}/v1/administration`, () =>
        HttpResponse.json({ message: 'No está disponible la revisión actual' }, { status: 500 }),
      ),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Revisar datos actuales' }))
    expect(await within(dialog).findByText('Error del servidor (500)')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Nombre del negocio')).toHaveValue('Tienda Centro nuevo')
    expect(within(dialog).queryByText(/Revisión actual cargada/)).not.toBeInTheDocument()
  })
})
