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

/**
 * Reproduce el dato real de AMAENA T (prod, 2026-09-14): costo SIN IVA y
 * agregador con 0 % del margen del agregador. El 0 y el `false` son valores
 * legítimos que tienen que hidratar tal cual — nunca caer al default (70 % / IVA).
 */
const costSinIva: ProviderCostStructure = {
  ...cost,
  debitRate: 0.0067,
  creditRate: 0.0067,
  amexRate: 0.028,
  internationalRate: 0.0325,
  includesTax: false,
}

const revenueShareAgregadorCero: MerchantRevenueShare = {
  ...revenueShare,
  aggregatorPrice: { DEBIT: 0.007, CREDIT: 0.007, AMEX: 0.028, INTERNATIONAL: 0.0325 },
  aggregatorPriceIncludesTax: false,
  avoqadoShareOfProviderMargin: 0.5,
  avoqadoShareOfAggregatorMargin: 0,
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

  /** Lo que tiene que verse con el dato de AMAENA T (ver fixtures arriba). */
  function expectAmaenaHidratada() {
    const input = (id: string) => document.getElementById(id) as HTMLInputElement
    // Costo del proveedor: 0.0067 → "0.67", y la casilla de IVA DESMARCADA.
    expect(input('cost-DEBIT').value).toBe('0.67')
    expect(input('cost-AMEX').value).toBe('2.8')
    expect(screen.getByLabelText('Las tasas ya incluyen IVA')).not.toBeChecked()
    // Modo agregador con su precio: 0.007 → "0.7", y su casilla de IVA DESMARCADA.
    expect(screen.getByLabelText(/Vía agregador/)).toBeChecked()
    expect(input('agg-DEBIT').value).toBe('0.7')
    expect(screen.getByLabelText(/El precio al agregador ya incluye IVA/)).not.toBeChecked()
    // 50 % del margen proveedor; 0 % del margen agregador. `PercentInput` pinta el 0
    // como campo vacío con placeholder "0" (a propósito) — lo que NO puede aparecer es el 70.
    expect(input('shp').value).toBe('50')
    expect(input('sha').value).toBe('')
    expect(input('sha').placeholder).toBe('0')
  }

  it('hidrata un 0 legítimo como 0 y "sin IVA" como desmarcado (no cae al default 70 % / con IVA)', () => {
    renderWithProviders(
      <EditEconomicsDrawer
        open
        merchantId="m1"
        cost={costSinIva}
        revenueShare={revenueShareAgregadorCero}
        onOpenChange={() => {}}
      />,
    )
    expectAmaenaHidratada()
  })

  it('siembra el formulario al ABRIR, no al montar: los datos que llegan después se ven al abrir', () => {
    // Bug real (AMAENA T, 2026-09-14): la página monta el drawer cerrado en cuanto llega el
    // merchant, ANTES de que carguen costo y revenue-share. Si el borrador se congela en ese
    // momento, al abrir se ven ceros, IVA marcado y 50/70 aunque la página de fondo ya
    // muestre los valores reales.
    const { rerender } = renderWithProviders(
      <EditEconomicsDrawer
        open={false}
        merchantId="m1"
        cost={null}
        revenueShare={null}
        onOpenChange={() => {}}
      />,
    )
    expect(screen.queryByText('Editar economía')).not.toBeInTheDocument()

    rerender(
      <EditEconomicsDrawer
        open
        merchantId="m1"
        cost={costSinIva}
        revenueShare={revenueShareAgregadorCero}
        onOpenChange={() => {}}
      />,
    )
    expect(screen.getByText('Editar economía')).toBeInTheDocument()
    expectAmaenaHidratada()
  })

  it('cada apertura vuelve a sembrar desde lo guardado (cerrar descarta lo tecleado)', () => {
    const { rerender } = renderWithProviders(
      <EditEconomicsDrawer
        open
        merchantId="m1"
        cost={costSinIva}
        revenueShare={revenueShareAgregadorCero}
        onOpenChange={() => {}}
      />,
    )
    fireEvent.change(document.getElementById('cost-DEBIT')!, { target: { value: '9' } })
    expect((document.getElementById('cost-DEBIT') as HTMLInputElement).value).toBe('9')

    rerender(
      <EditEconomicsDrawer
        open={false}
        merchantId="m1"
        cost={costSinIva}
        revenueShare={revenueShareAgregadorCero}
        onOpenChange={() => {}}
      />,
    )
    rerender(
      <EditEconomicsDrawer
        open
        merchantId="m1"
        cost={costSinIva}
        revenueShare={revenueShareAgregadorCero}
        onOpenChange={() => {}}
      />,
    )
    expectAmaenaHidratada()
  })
})
