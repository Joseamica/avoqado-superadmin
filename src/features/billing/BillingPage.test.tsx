import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { BillingPage } from './BillingPage'
import type { PlatformCfdi } from './types'

const baseURL = 'http://localhost:3000/api/v1'

const base: PlatformCfdi = {
  id: 'c0',
  platformEmisorId: 'e1',
  billingTaxProfileId: 'tp1',
  type: 'INGRESO',
  parentPlatformCfdiId: null,
  organizationId: null,
  venueId: null,
  receptorRfc: 'XAXX010101000',
  receptorNombre: 'Receptor',
  receptorRegimen: '601',
  receptorCp: '06000',
  usoCfdi: 'G03',
  lines: null,
  formaPago: '03',
  metodoPago: 'PUE',
  subtotalCents: 100000,
  discountCents: 0,
  taxCents: 16000,
  totalCents: 116000,
  currency: 'MXN',
  amountPaidCents: 0,
  paymentInfo: null,
  status: 'STAMPED',
  facturapiId: null,
  uuid: null,
  serie: 'A',
  folio: null,
  stampedAt: '2026-06-20T00:00:00.000Z',
  cancelMotivo: null,
  cancelStatus: null,
  cancelledAt: null,
  emailSentAt: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
}

function cfdi(overrides: Partial<PlatformCfdi>): PlatformCfdi {
  return { ...base, ...overrides }
}

// Filas que ejercitan las ramas de cada columna: PPD pendiente, PUE (sin pago),
// y un complemento de pago (REP).
const rows: PlatformCfdi[] = [
  cfdi({
    id: 'c1',
    receptorNombre: 'Cliente Uno',
    metodoPago: 'PPD',
    amountPaidCents: 0,
    totalCents: 116000,
    uuid: 'UUID-1',
    folio: '101',
  }),
  cfdi({
    id: 'c2',
    receptorNombre: 'Cliente Dos',
    metodoPago: 'PUE',
    amountPaidCents: 50000,
    totalCents: 50000,
    uuid: 'UUID-2',
    folio: '102',
  }),
  cfdi({
    id: 'c3',
    receptorNombre: 'Cliente Tres',
    type: 'PAGO',
    metodoPago: 'PPD',
    totalCents: 30000,
    folio: '103',
  }),
]

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('BillingPage', () => {
  it('renderiza la tabla de CFDIs con sus columnas y los KPIs', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/emisor`, () =>
        HttpResponse.json({ success: true, data: { id: 'e1', csdStatus: 'ACTIVE', serie: 'A' } }),
      ),
      http.get(`${baseURL}/superadmin/billing/invoices`, () =>
        HttpResponse.json({
          success: true,
          data: rows,
          meta: { total: rows.length, page: 1, pageSize: 100 },
        }),
      ),
    )

    renderWithProviders(<BillingPage />)

    await waitFor(() => expect(screen.getByText('Cliente Uno')).toBeInTheDocument(), {
      timeout: 4000,
    })
    expect(screen.getByText('Cliente Dos')).toBeInTheDocument()
    expect(screen.getByText('Cliente Tres')).toBeInTheDocument()

    // La fila tipo PAGO muestra el badge REP.
    expect(screen.getByText('REP')).toBeInTheDocument()
    // El CFDI PPD sin abonos aparece como "Pendiente" en la columna Pago PPD.
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
  })

  it('muestra el aviso cuando el emisor no tiene CSD activo', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/billing/emisor`, () =>
        HttpResponse.json({ success: true, data: { id: 'e1', csdStatus: 'NONE', serie: 'A' } }),
      ),
      http.get(`${baseURL}/superadmin/billing/invoices`, () =>
        HttpResponse.json({ success: true, data: [], meta: { total: 0, page: 1, pageSize: 100 } }),
      ),
    )

    renderWithProviders(<BillingPage />)

    await waitFor(
      () =>
        expect(
          screen.getByText('El emisor de Avoqado aún no está listo para timbrar'),
        ).toBeInTheDocument(),
      { timeout: 4000 },
    )
  })
})
