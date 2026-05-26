import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { EditEconomicsDrawer } from './EditEconomicsDrawer'
import type { ProviderCostStructure, MerchantRevenueShare } from './types'

const baseURL = 'http://localhost:3000/api/v1'

const cost: ProviderCostStructure = {
  id: 'c1',
  merchantAccountId: 'm1',
  debitRate: 0.015,
  creditRate: 0.025,
  amexRate: 0.035,
  internationalRate: 0.04,
  includesTax: true,
  taxRate: 0.16,
  fixedCostPerTransaction: null,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  active: true,
}

const revenueShare: MerchantRevenueShare = {
  id: 'rs1',
  merchantAccountId: 'm1',
  aggregatorPrice: null,
  aggregatorPriceIncludesTax: false,
  avoqadoShareOfProviderMargin: 0.5,
  avoqadoShareOfAggregatorMargin: null,
  taxRate: 0.16,
  active: true,
}

let capturedCostBody: Record<string, unknown> | null = null

const server = setupServer(
  http.put(`${baseURL}/superadmin/cost-structures/c1`, async ({ request }) => {
    capturedCostBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ data: {} })
  }),
  http.put(`${baseURL}/superadmin/merchant-revenue-shares/rs1`, () => {
    return HttpResponse.json({ data: {} })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  capturedCostBody = null
})
afterAll(() => server.close())

describe('EditEconomicsDrawer', () => {
  it('envía debitRate convertido correctamente de % a decimal al cambiar el input de Débito', async () => {
    renderWithProviders(
      <EditEconomicsDrawer
        open
        merchantId="m1"
        cost={cost}
        revenueShare={revenueShare}
        onOpenChange={() => {}}
      />,
    )

    // El drawer debe estar visible
    expect(screen.getByText('Editar economía')).toBeInTheDocument()

    // Localizar el input de Débito (label "Débito (%)")
    const debitInput = screen.getByLabelText('Débito (%)')
    expect(debitInput).toBeInTheDocument()

    // Cambiar el valor a "2" (i.e. 2% → 0.02 en decimal)
    fireEvent.change(debitInput, { target: { value: '2' } })

    // Enviar el form
    const submitBtn = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.click(submitBtn)

    // Esperar a que se capture el body del PUT a cost-structures/c1
    await waitFor(() => {
      expect(capturedCostBody).not.toBeNull()
    })

    // La conversión %→decimal: "2" / 100 = 0.02
    expect(capturedCostBody!.debitRate).toBe(0.02)
  })

  it('muestra el título y las secciones principales', () => {
    renderWithProviders(
      <EditEconomicsDrawer
        open
        merchantId="m1"
        cost={cost}
        revenueShare={revenueShare}
        onOpenChange={() => {}}
      />,
    )

    expect(screen.getByText('Editar economía')).toBeInTheDocument()
    expect(screen.getByText('Costo del proveedor')).toBeInTheDocument()
    expect(screen.getByText('Revenue-share')).toBeInTheDocument()
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('en modo agregador aclara qué es el "Precio al agregador"', () => {
    renderWithProviders(
      <EditEconomicsDrawer
        open
        merchantId="m1"
        cost={cost}
        revenueShare={revenueShare}
        onOpenChange={() => {}}
      />,
    )
    // Arranca en "Directa" (aggregatorPrice null) → cambiar a "Vía agregador".
    fireEvent.click(screen.getByLabelText(/Vía agregador/))
    expect(screen.getByText(/antes del\s+markup del agregador/i)).toBeInTheDocument()
    expect(screen.getByText(/se queda Avoqado del markup del agregador/i)).toBeInTheDocument()
    // El precio al agregador tiene su propio control de IVA (como el costo).
    expect(screen.getByLabelText(/El precio al agregador ya incluye IVA/)).toBeInTheDocument()
  })

  it('pre-llena los inputs con los valores del cost existente', () => {
    renderWithProviders(
      <EditEconomicsDrawer
        open
        merchantId="m1"
        cost={cost}
        revenueShare={revenueShare}
        onOpenChange={() => {}}
      />,
    )

    // cost.debitRate = 0.015 → se muestra como "1.5" en el input (×100)
    const debitInput = screen.getByLabelText('Débito (%)') as HTMLInputElement
    expect(debitInput.value).toBe('1.5')
  })
})
