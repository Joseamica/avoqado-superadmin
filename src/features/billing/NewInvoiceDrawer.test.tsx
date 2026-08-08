import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'sonner'
import { renderWithProviders } from '@/test/render'
import { NewInvoiceDrawer } from './NewInvoiceDrawer'

const baseURL = 'http://localhost:3000/api/v1'

// Un venue cuyo nombre COMERCIAL trae un typo y que aún no tiene perfil fiscal:
// exactamente la forma del incidente de La Galeterie (comercial "La Galaterie",
// razón social real "LA GALETERIE").
//
// `profileRequests` deja de ser 0 sólo cuando el handler del perfil fiscal
// realmente respondió — lo usamos como señal para no leer el campo antes de
// que `handleSelectCustomer` haya terminado su `await`. Si se lee el valor
// de inmediato tras el click, el campo todavía está en su estado inicial
// ('') y el test "pasaría" sin haber ejercitado el prellenado en absoluto
// (falso negativo tanto con el bug presente como sin él).
let profileRequests = 0

const server = setupServer(
  http.get(`${baseURL}/superadmin/billing/customers`, () =>
    HttpResponse.json({
      success: true,
      data: [{ type: 'VENUE', id: 'v1', name: 'La Galaterie', hasProfile: false }],
    }),
  ),
  http.get(`${baseURL}/superadmin/billing/customers/VENUE/v1/tax-profile`, () => {
    profileRequests += 1
    return HttpResponse.json({ success: true, data: null })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  profileRequests = 0
})
afterAll(() => server.close())

describe('NewInvoiceDrawer — razón social', () => {
  it('NO prellena la razón social con el nombre del venue cuando no hay perfil fiscal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NewInvoiceDrawer open onOpenChange={() => {}} defaultSerie="A" />)

    const search = await screen.findByLabelText(/buscar organización o venue/i)
    await user.type(search, 'Galaterie')
    await user.click(await screen.findByText('La Galaterie'))

    // Espera a que el fetch del perfil fiscal haya respondido Y a que el campo
    // haya terminado de reflejar ese resultado. Combinar ambas condiciones en
    // el mismo `waitFor` evita que la primera evaluación (síncrona, antes de
    // que el `await` de `handleSelectCustomer` se resuelva) dé un falso "pasó".
    await waitFor(() => {
      expect(profileRequests).toBeGreaterThan(0)
      const razonSocial = screen.getByLabelText(/razón social/i) as HTMLInputElement
      expect(razonSocial.value).toBe('')
    })
  })
})

describe('NewInvoiceDrawer — veredicto del SAT antes de timbrar', () => {
  const validProfile = {
    id: 'profile_1',
    customerType: 'VENUE',
    organizationId: null,
    venueId: 'v2',
    displayName: null,
    rfc: 'XAXX010101000',
    razonSocial: 'VENUE CON PERFIL SA DE CV',
    regimenFiscal: '601',
    codigoPostal: '12345',
    defaultUsoCfdi: 'G03',
    email: null,
    constanciaUrl: null,
    validationStatus: 'PENDING',
    validatedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
  const rejectionMessage = 'El nombre no coincide con el SAT'

  it('aborta ANTES de timbrar cuando el SAT rechaza los datos: nunca llama POST /invoices', async () => {
    let putRequests = 0
    let invoiceRequests = 0

    server.use(
      http.get(`${baseURL}/superadmin/billing/customers`, () =>
        HttpResponse.json({
          success: true,
          data: [{ type: 'VENUE', id: 'v2', name: 'Venue Con Perfil', hasProfile: true }],
        }),
      ),
      http.get(`${baseURL}/superadmin/billing/customers/VENUE/v2/tax-profile`, () =>
        HttpResponse.json({ success: true, data: validProfile }),
      ),
      http.put(`${baseURL}/superadmin/billing/tax-profiles`, () => {
        putRequests += 1
        return HttpResponse.json({
          success: true,
          data: validProfile,
          validation: {
            valid: false,
            errors: [{ field: 'razonSocial', message: rejectionMessage }],
          },
        })
      }),
      http.post(`${baseURL}/superadmin/billing/invoices`, () => {
        invoiceRequests += 1
        return HttpResponse.json({ success: true, data: {} })
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(
      <>
        <NewInvoiceDrawer open onOpenChange={() => {}} defaultSerie="A" />
        <Toaster />
      </>,
    )

    const search = await screen.findByLabelText(/buscar organización o venue/i)
    await user.type(search, 'Con Perfil')
    await user.click(await screen.findByText('Venue Con Perfil'))

    // Espera a que el perfil (válido) haya prellenado el formulario antes de seguir.
    await waitFor(() => {
      const razonSocial = screen.getByLabelText(/razón social/i) as HTMLInputElement
      expect(razonSocial.value).toBe(validProfile.razonSocial)
    })

    // Agrega un concepto válido vía preset para poder habilitar "Timbrar".
    await user.click(screen.getByRole('button', { name: /mensualidad 1599\+iva/i }))

    const submitButton = await screen.findByRole('button', { name: /^timbrar/i })
    await waitFor(() => expect(submitButton).not.toBeDisabled())
    await user.click(submitButton)

    // El PUT (guardar perfil) sí se llama y trae el veredicto del SAT — el mensaje del
    // campo culpable debe aparecer en pantalla (toast y/o error debajo del campo).
    await waitFor(() => {
      expect(putRequests).toBeGreaterThan(0)
      expect(screen.getAllByText(rejectionMessage).length).toBeGreaterThan(0)
    })
    // El botón vuelve a su estado normal: la función ya terminó de correr (incluyendo
    // el `return` temprano), así que el POST /invoices — si fuera a pasar — ya habría pasado.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^timbrar/i })).not.toBeDisabled(),
    )

    // El punto que importa: NUNCA se gastó timbre.
    expect(invoiceRequests).toBe(0)
  })

  it('el rechazo de un cliente no se queda pegado al cambiar a otro cliente (botón "Cambiar")', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/customers`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { type: 'VENUE', id: 'v2', name: 'Venue Con Perfil', hasProfile: true },
            { type: 'VENUE', id: 'v3', name: 'Otro Venue', hasProfile: false },
          ],
        }),
      ),
      http.get(`${baseURL}/superadmin/billing/customers/VENUE/v2/tax-profile`, () =>
        HttpResponse.json({ success: true, data: validProfile }),
      ),
      http.get(`${baseURL}/superadmin/billing/customers/VENUE/v3/tax-profile`, () =>
        HttpResponse.json({ success: true, data: null }),
      ),
      http.put(`${baseURL}/superadmin/billing/tax-profiles`, () =>
        HttpResponse.json({
          success: true,
          data: validProfile,
          validation: {
            valid: false,
            errors: [{ field: 'razonSocial', message: rejectionMessage }],
          },
        }),
      ),
    )

    const user = userEvent.setup()
    // Sin <Toaster/> a propósito: así aislamos la verificación al error DEL CAMPO
    // (el que vive en `fieldErrors`), sin que un toast con el mismo texto confunda
    // el resultado — el hallazgo es sobre `fieldErrors`, no sobre los toasts.
    renderWithProviders(<NewInvoiceDrawer open onOpenChange={() => {}} defaultSerie="A" />)

    const search = await screen.findByLabelText(/buscar organización o venue/i)
    await user.type(search, 'Con Perfil')
    await user.click(await screen.findByText('Venue Con Perfil'))

    await waitFor(() => {
      const razonSocial = screen.getByLabelText(/razón social/i) as HTMLInputElement
      expect(razonSocial.value).toBe(validProfile.razonSocial)
    })

    await user.click(screen.getByRole('button', { name: /mensualidad 1599\+iva/i }))
    const submitButton = await screen.findByRole('button', { name: /^timbrar/i })
    await waitFor(() => expect(submitButton).not.toBeDisabled())
    await user.click(submitButton)

    // El SAT rechazó al Cliente A (v2): el campo Razón social queda marcado en rojo.
    await waitFor(() => {
      expect(screen.getByText(rejectionMessage)).toBeInTheDocument()
    })

    // El operador da clic en "Cambiar" y selecciona un cliente DISTINTO (v3, sin perfil).
    await user.click(screen.getByRole('button', { name: /cambiar/i }))
    const search2 = await screen.findByLabelText(/buscar organización o venue/i)
    await user.type(search2, 'Otro')
    await user.click(await screen.findByText('Otro Venue'))

    // v3 no tiene perfil fiscal propio -> razón social se limpia. El error de A
    // (nunca validado contra B) NO debe seguir pegado al campo.
    await waitFor(() => {
      const razonSocial = screen.getByLabelText(/razón social/i) as HTMLInputElement
      expect(razonSocial.value).toBe('')
    })
    expect(screen.queryByText(rejectionMessage)).not.toBeInTheDocument()
  })

  it('"Cambiar" resetea el perfil del cliente anterior de inmediato: el badge "Verificado con el SAT" de A no se queda pegado bajo la identidad de B', async () => {
    // A propósito VALID (a diferencia del `validProfile` PENDING de arriba) — el badge
    // "Verificado con el SAT" que este test vigila sólo se pinta con perfil VALID.
    const validProfileA = {
      ...validProfile,
      validationStatus: 'VALID',
      validatedAt: '2026-08-01T00:00:00.000Z',
    }

    server.use(
      http.get(`${baseURL}/superadmin/billing/customers`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { type: 'VENUE', id: 'v2', name: 'Venue Con Perfil', hasProfile: true },
            { type: 'VENUE', id: 'v3', name: 'Otro Venue', hasProfile: false },
          ],
        }),
      ),
      http.get(`${baseURL}/superadmin/billing/customers/VENUE/v2/tax-profile`, () =>
        HttpResponse.json({ success: true, data: validProfileA }),
      ),
      // Delay a propósito: abre la ventana async en la que `handleSelectCustomer` ya hizo
      // `setCustomer(rowB)` pero el fetch del perfil de B todavía no resuelve — exactamente
      // la ventana en la que el bug dejaba ver el perfil (y el badge) de A bajo la
      // identidad de B.
      http.get(`${baseURL}/superadmin/billing/customers/VENUE/v3/tax-profile`, async () => {
        await delay(50)
        return HttpResponse.json({ success: true, data: null })
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<NewInvoiceDrawer open onOpenChange={() => {}} defaultSerie="A" />)

    const search = await screen.findByLabelText(/buscar organización o venue/i)
    await user.type(search, 'Con Perfil')
    await user.click(await screen.findByText('Venue Con Perfil'))

    // Venue A (v2, perfil VALID) queda seleccionado y verificado con el SAT.
    await waitFor(() => {
      expect(screen.getByText(/verificado con el sat/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /cambiar/i }))
    const search2 = await screen.findByLabelText(/buscar organización o venue/i)
    await user.type(search2, 'Otro')
    await user.click(await screen.findByText('Otro Venue'))

    // El punto que importa: en la ventana ANTES de que resuelva el fetch del perfil de B
    // (el `delay(50)` de arriba la abre a propósito), el badge/estado de A ya no debe
    // seguir en pantalla bajo la identidad de B.
    expect(screen.queryByText(/verificado con el sat/i)).not.toBeInTheDocument()

    // Cuando el fetch de B resuelve (sin perfil propio), el aviso correcto para B aparece.
    await waitFor(() => {
      expect(screen.getByText(/todavía no ha capturado sus datos fiscales/i)).toBeInTheDocument()
    })
  })
})

describe('NewInvoiceDrawer — perfil VALID: el superadmin no teclea nada', () => {
  const validatedProfile = {
    id: 'profile_valid',
    customerType: 'VENUE',
    organizationId: null,
    venueId: 'v9',
    displayName: null,
    rfc: 'XAXX010101000',
    razonSocial: 'VENUE VERIFICADO SA DE CV',
    regimenFiscal: '601',
    codigoPostal: '12345',
    defaultUsoCfdi: 'G03',
    email: null,
    constanciaUrl: null,
    validationStatus: 'VALID',
    validatedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }

  it('con perfil VALID, Razón social queda deshabilitada con el badge; "Corregir" la habilita', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/customers`, () =>
        HttpResponse.json({
          success: true,
          data: [{ type: 'VENUE', id: 'v9', name: 'Venue Verificado', hasProfile: true }],
        }),
      ),
      http.get(`${baseURL}/superadmin/billing/customers/VENUE/v9/tax-profile`, () =>
        HttpResponse.json({ success: true, data: validatedProfile }),
      ),
    )

    const user = userEvent.setup()
    renderWithProviders(<NewInvoiceDrawer open onOpenChange={() => {}} defaultSerie="A" />)

    const search = await screen.findByLabelText(/buscar organización o venue/i)
    await user.type(search, 'Verificado')
    await user.click(await screen.findByText('Venue Verificado'))

    // El perfil VALID prellena Y deshabilita el campo — nada que teclear en el camino feliz.
    await waitFor(() => {
      const razonSocial = screen.getByLabelText(/razón social/i) as HTMLInputElement
      expect(razonSocial.value).toBe(validatedProfile.razonSocial)
      expect(razonSocial).toBeDisabled()
    })

    expect(screen.getByText(/verificado con el sat/i)).toBeInTheDocument()

    // "Corregir" vuelve a habilitar los campos — el superadmin nunca queda bloqueado.
    await user.click(screen.getByRole('button', { name: /corregir/i }))

    await waitFor(() => {
      const razonSocial = screen.getByLabelText(/razón social/i) as HTMLInputElement
      expect(razonSocial).not.toBeDisabled()
    })
  })

  it('sin perfil: aviso de "todavía no ha capturado" y campos editables', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/customers`, () =>
        HttpResponse.json({
          success: true,
          data: [{ type: 'VENUE', id: 'v10', name: 'Venue Sin Perfil', hasProfile: false }],
        }),
      ),
      http.get(`${baseURL}/superadmin/billing/customers/VENUE/v10/tax-profile`, () =>
        HttpResponse.json({ success: true, data: null }),
      ),
    )

    const user = userEvent.setup()
    renderWithProviders(<NewInvoiceDrawer open onOpenChange={() => {}} defaultSerie="A" />)

    const search = await screen.findByLabelText(/buscar organización o venue/i)
    await user.type(search, 'Sin Perfil')
    await user.click(await screen.findByText('Venue Sin Perfil'))

    await waitFor(() => {
      expect(screen.getByText(/todavía no ha capturado sus datos fiscales/i)).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/razón social/i)).not.toBeDisabled()
  })

  it('perfil INVALID: aviso de "el SAT no reconoce" y campos editables', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/customers`, () =>
        HttpResponse.json({
          success: true,
          data: [{ type: 'VENUE', id: 'v11', name: 'Venue Invalido', hasProfile: true }],
        }),
      ),
      http.get(`${baseURL}/superadmin/billing/customers/VENUE/v11/tax-profile`, () =>
        HttpResponse.json({
          success: true,
          data: {
            ...validatedProfile,
            id: 'profile_invalid',
            venueId: 'v11',
            validationStatus: 'INVALID',
          },
        }),
      ),
    )

    const user = userEvent.setup()
    renderWithProviders(<NewInvoiceDrawer open onOpenChange={() => {}} defaultSerie="A" />)

    const search = await screen.findByLabelText(/buscar organización o venue/i)
    await user.type(search, 'Invalido')
    await user.click(await screen.findByText('Venue Invalido'))

    await waitFor(() => {
      expect(screen.getByText(/el sat no reconoce los datos fiscales/i)).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/razón social/i)).not.toBeDisabled()
  })

  it('"Revalidar con el SAT" llama validateTaxProfile(profile.id) y refresca el estado', async () => {
    let validateRequests = 0
    server.use(
      http.get(`${baseURL}/superadmin/billing/customers`, () =>
        HttpResponse.json({
          success: true,
          data: [{ type: 'VENUE', id: 'v9', name: 'Venue Verificado', hasProfile: true }],
        }),
      ),
      http.get(`${baseURL}/superadmin/billing/customers/VENUE/v9/tax-profile`, () =>
        HttpResponse.json({ success: true, data: validatedProfile }),
      ),
      http.post(`${baseURL}/superadmin/billing/tax-profiles/profile_valid/validate`, () => {
        validateRequests += 1
        return HttpResponse.json({
          success: true,
          data: validatedProfile,
          validation: { valid: true, errors: [] },
        })
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<NewInvoiceDrawer open onOpenChange={() => {}} defaultSerie="A" />)

    const search = await screen.findByLabelText(/buscar organización o venue/i)
    await user.type(search, 'Verificado')
    await user.click(await screen.findByText('Venue Verificado'))

    const revalidateButton = await screen.findByRole('button', { name: /revalidar con el sat/i })
    await user.click(revalidateButton)

    await waitFor(() => expect(validateRequests).toBe(1))
  })
})
