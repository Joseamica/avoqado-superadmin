import { describe, expect, it, vi, beforeAll } from 'vitest'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, waitFor, within } from '@/test/render'
import { installGlobalServer, server } from '@/test/mocks/server'
import { TpvOrdersPage } from './TpvOrdersPage'
import type { TerminalOrder } from './types'

installGlobalServer()

const baseURL = 'http://localhost:3000/api/v1'

// Radix Popover (FilterPill / ExportDialog) usa ResizeObserver y scrollIntoView.
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

function makeOrder(overrides: Partial<TerminalOrder>): TerminalOrder {
  return {
    id: 'ord_1',
    orderNumber: 'TPV-2026-0001',
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
    paymentStatus: 'AWAITING_PAYMENT',
    fulfillmentStatus: 'NEW',
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
    ...overrides,
  }
}

const orders: TerminalOrder[] = [
  makeOrder({
    id: 'ord_1',
    orderNumber: 'TPV-2026-0001',
    paymentMethod: 'SPEI',
    paymentStatus: 'PROOF_UPLOADED',
    fulfillmentStatus: 'NEW',
    createdAt: '2026-06-01T12:00:00.000Z',
  }),
  makeOrder({
    id: 'ord_2',
    orderNumber: 'TPV-2026-0002',
    paymentMethod: 'CARD_STRIPE',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'AWAITING_SERIALS',
    createdAt: '2026-06-02T12:00:00.000Z',
  }),
  makeOrder({
    id: 'ord_3',
    orderNumber: 'TPV-2026-0003',
    paymentMethod: 'SPEI',
    paymentStatus: 'AWAITING_PAYMENT',
    fulfillmentStatus: 'NEW',
    createdAt: '2026-06-03T12:00:00.000Z',
  }),
]

function mockList(data: TerminalOrder[]) {
  server.use(
    http.get(`${baseURL}/superadmin/tpv-orders`, () => HttpResponse.json({ success: true, data })),
  )
}

describe('<TpvOrdersPage />', () => {
  it('renderiza la tabla con los pedidos y el KPI prioriza comprobantes por revisar', async () => {
    mockList(orders)
    renderWithProviders(<TpvOrdersPage />)

    await waitFor(() => expect(screen.getByText('TPV-2026-0001')).toBeInTheDocument())
    expect(screen.getByText('TPV-2026-0002')).toBeInTheDocument()
    expect(screen.getByText('TPV-2026-0003')).toBeInTheDocument()

    // Prioridad del KPI focus: PROOF_UPLOADED gana sobre AWAITING_SERIALS.
    // Scope al strip de KPIs — "Total" también es header de columna.
    const kpis = within(screen.getByRole('region', { name: 'Indicadores de pedidos TPV' }))
    expect(kpis.getByText('Comprobantes por revisar')).toBeInTheDocument()
    expect(kpis.getByText('Total')).toBeInTheDocument()
    expect(kpis.getByText('Pagados')).toBeInTheDocument()
    expect(kpis.getByText('Esperando pago')).toBeInTheDocument()
  })

  it('el KPI focus cae a "Asignar serials" cuando no hay comprobantes pendientes', async () => {
    mockList([orders[1], orders[2]])
    renderWithProviders(<TpvOrdersPage />)

    await waitFor(() => expect(screen.getByText('TPV-2026-0002')).toBeInTheDocument())
    // "Asignar serials" también aparece como badge de fulfillment → scope al strip.
    const kpis = within(screen.getByRole('region', { name: 'Indicadores de pedidos TPV' }))
    expect(kpis.getByText('Asignar serials')).toBeInTheDocument()
    expect(kpis.queryByText('Comprobantes por revisar')).not.toBeInTheDocument()
  })

  it('filtra por estado de pago y limpia con "Borrar filtros"', async () => {
    const user = userEvent.setup()
    mockList(orders)
    renderWithProviders(<TpvOrdersPage />)
    await waitFor(() => expect(screen.getByText('TPV-2026-0001')).toBeInTheDocument())

    // El primer botón "Pago" en orden DOM es el FilterPill del toolbar
    // (el header de columna "Pago" viene después, dentro de la tabla).
    await user.click(screen.getAllByRole('button', { name: 'Pago' })[0])
    const popover = await screen.findByRole('dialog')
    await user.click(within(popover).getByText('Pagado'))
    await user.click(within(popover).getByRole('button', { name: 'Aplicar' }))

    // Sólo queda el pedido PAID.
    await waitFor(() => expect(screen.queryByText('TPV-2026-0001')).not.toBeInTheDocument())
    expect(screen.getByText('TPV-2026-0002')).toBeInTheDocument()
    expect(screen.queryByText('TPV-2026-0003')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Borrar filtros' }))
    await waitFor(() => expect(screen.getByText('TPV-2026-0001')).toBeInTheDocument())
    expect(screen.getByText('TPV-2026-0003')).toBeInTheDocument()
  })

  it('muestra el empty state cuando no hay pedidos', async () => {
    mockList([])
    renderWithProviders(<TpvOrdersPage />)
    await waitFor(() => expect(screen.getByText('Sin pedidos TPV')).toBeInTheDocument())
    expect(screen.getByText('Cuando un venue compre hardware aparecerá aquí.')).toBeInTheDocument()
  })

  it('muestra QueryError cuando el listado falla y reintenta con el botón', async () => {
    const user = userEvent.setup()
    let calls = 0
    server.use(
      http.get(`${baseURL}/superadmin/tpv-orders`, () => {
        calls += 1
        if (calls === 1) return HttpResponse.json({ error: 'boom' }, { status: 500 })
        return HttpResponse.json({ success: true, data: orders })
      }),
    )
    renderWithProviders(<TpvOrdersPage />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert').textContent).toMatch(/Error del servidor/i)

    // Reintentar dispara query.refetch() y la tabla se llena.
    await user.click(screen.getByRole('button', { name: /Reintentar/ }))
    await waitFor(() => expect(screen.getByText('TPV-2026-0001')).toBeInTheDocument())
  })

  it('exporta el CSV (ejercita los accessors de todas las columnas exportables)', async () => {
    const origCreate = globalThis.URL.createObjectURL
    const origRevoke = globalThis.URL.revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock') as typeof URL.createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL
    try {
      const user = userEvent.setup()
      mockList(orders)
      renderWithProviders(<TpvOrdersPage />)
      await waitFor(() => expect(screen.getByText('TPV-2026-0001')).toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: /Exportar/ }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /Descargar/ }))
      await waitFor(() => expect(globalThis.URL.createObjectURL).toHaveBeenCalled())
    } finally {
      globalThis.URL.createObjectURL = origCreate
      globalThis.URL.revokeObjectURL = origRevoke
    }
  })
})
