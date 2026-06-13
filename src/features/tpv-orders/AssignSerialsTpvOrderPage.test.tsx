import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render'
import { installGlobalServer, server } from '@/test/mocks/server'
import { AssignSerialsTpvOrderPage } from './AssignSerialsTpvOrderPage'
import type { AssignSerialsPayload, TerminalOrder } from './types'

installGlobalServer()

const baseURL = 'http://localhost:3000/api/v1'

const orderMock: TerminalOrder = {
  id: 'ord_1',
  orderNumber: 'TPV-2026-0042',
  venueId: 'venue_1',
  venue: { id: 'venue_1', name: 'Madre Cafecito', slug: 'madre-cafecito' },
  contactName: 'Ana López',
  contactEmail: 'ana@madrecafecito.mx',
  contactPhone: '+52 55 1234 5678',
  shippingAddress: 'Av. Insurgentes Sur 123',
  shippingAddress2: null,
  shippingCity: 'Ciudad de México',
  shippingState: 'CDMX',
  shippingZip: '03100',
  shippingCountry: 'MX',
  paymentMethod: 'SPEI',
  paymentStatus: 'PAID',
  fulfillmentStatus: 'AWAITING_SERIALS',
  subtotalCents: 500000,
  taxCents: 80000,
  totalCents: 580000,
  currency: 'MXN',
  stripeReceiptUrl: null,
  speiProofUrl: null,
  speiRejectionReason: null,
  items: [
    {
      id: 'item_1',
      brand: 'PAX',
      model: 'A910S',
      productName: 'Terminal PAX A910S',
      quantity: 2,
      unitPriceCents: 250000,
      namePrefix: 'PAX A910 Caja',
    },
  ],
  createdAt: '2026-06-01T12:00:00.000Z',
  updatedAt: '2026-06-01T12:00:00.000Z',
}

function renderAssignSerialsPage(entry: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/tpv-orders/:id/assign-serials" element={<AssignSerialsTpvOrderPage />} />
    </Routes>,
    { initialEntries: [entry] },
  )
}

describe('<AssignSerialsTpvOrderPage />', () => {
  it('valida el token al montar, renderiza el form con los items y postea los serials (happy path)', async () => {
    let checkToken: string | null = null
    let submitToken: string | null = null
    let submitBody: AssignSerialsPayload | null = null
    server.use(
      http.get(`${baseURL}/public/tpv-orders/ord_1/assign-serials/check`, ({ request }) => {
        checkToken = new URL(request.url).searchParams.get('token')
        return HttpResponse.json({ success: true, data: orderMock })
      }),
      http.post(`${baseURL}/public/tpv-orders/ord_1/assign-serials`, async ({ request }) => {
        submitToken = new URL(request.url).searchParams.get('token')
        submitBody = (await request.json()) as AssignSerialsPayload
        return HttpResponse.json({
          success: true,
          data: { orderId: 'ord_1', orderNumber: 'TPV-2026-0042' },
        })
      }),
    )

    renderAssignSerialsPage('/admin/tpv-orders/ord_1/assign-serials?token=tok_valido')

    // Fase 1: el token se valida con assign-serials/check y aparece el form con los items.
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /asignar números de serie/i }),
      ).toBeInTheDocument(),
    )
    expect(checkToken).toBe('tok_valido')
    expect(screen.getByText('TPV-2026-0042')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /terminal pax a910s/i })).toBeInTheDocument()

    // Los nombres vienen pre-llenados con `${namePrefix} ${i + 1}`; los serials vacíos
    // dejan el CTA deshabilitado hasta que se llenan todos.
    expect(screen.getByLabelText('Unidad 1 — nombre')).toHaveValue('PAX A910 Caja 1')
    expect(screen.getByLabelText('Unidad 2 — nombre')).toHaveValue('PAX A910 Caja 2')
    const submitButton = screen.getByRole('button', { name: /asignar y notificar al cliente/i })
    expect(submitButton).toBeDisabled()

    // Fase 2: llenar los serials habilita el submit.
    const serialInputs = screen.getAllByLabelText('Serial físico')
    expect(serialInputs).toHaveLength(2)
    fireEvent.change(serialInputs[0], { target: { value: 'A910S-2026-000111' } })
    fireEvent.change(serialInputs[1], { target: { value: 'A910S-2026-000222' } })
    expect(submitButton).toBeEnabled()

    fireEvent.click(submitButton)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /serials asignados/i })).toBeInTheDocument(),
    )
    expect(submitToken).toBe('tok_valido')
    expect(submitBody).toEqual({
      items: [
        {
          orderItemId: 'item_1',
          units: [
            { name: 'PAX A910 Caja 1', serial: 'A910S-2026-000111' },
            { name: 'PAX A910 Caja 2', serial: 'A910S-2026-000222' },
          ],
        },
      ],
    })
    expect(screen.getByText(/códigos de activación/i)).toBeInTheDocument()
  })

  it('muestra el estado de error con el mensaje del servidor cuando el token es inválido o expiró (401)', async () => {
    server.use(
      http.get(`${baseURL}/public/tpv-orders/ord_1/assign-serials/check`, () =>
        HttpResponse.json({ error: 'El link para asignar serials expiró.' }, { status: 401 }),
      ),
    )

    renderAssignSerialsPage('/admin/tpv-orders/ord_1/assign-serials?token=tok_expirado')

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /link inválido/i })).toBeInTheDocument(),
    )
    expect(screen.getByText('El link para asignar serials expiró.')).toBeInTheDocument()
    expect(screen.getByText(/inicia sesión como superadmin/i)).toBeInTheDocument()
  })
})
