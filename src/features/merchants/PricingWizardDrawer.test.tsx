import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PricingWizardDrawer } from './PricingWizardDrawer'
import type { ProviderCostStructure } from './types'

const venues = [{ venueId: 'v1', venueName: 'Berthe', slot: 'SECONDARY' as const }]

/**
 * Dato real de AMAENA T (prod, 2026-09-14): costo SIN IVA. El `false` es un valor
 * legítimo que tiene que hidratar tal cual — nunca caer al default (con IVA).
 */
const costoSinIva: ProviderCostStructure = {
  id: 'c1',
  merchantAccountId: 'm1',
  debitRate: 0.0067,
  creditRate: 0.0067,
  amexRate: 0.028,
  internationalRate: 0.0325,
  includesTax: false,
  taxRate: 0.16,
  fixedCostPerTransaction: null,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  active: true,
}

const input = (id: string) => document.getElementById(id) as HTMLInputElement

/** Lo que tiene que verse en el paso 1 con el costo de AMAENA T. */
function expectPaso1ConCostoDeAmaena() {
  expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument()
  // 0.0067 → "0.67" (×100), y la casilla de IVA DESMARCADA.
  expect(input('wiz-cost-DEBIT').value).toBe('0.67')
  expect(input('wiz-cost-AMEX').value).toBe('2.8')
  expect(screen.getByLabelText('Estas tasas ya incluyen IVA')).not.toBeChecked()
}

describe('PricingWizardDrawer', () => {
  it('recorre flat y emite onPrefill con el pricing pareja', () => {
    const onPrefill = vi.fn()
    render(
      <PricingWizardDrawer
        open
        onOpenChange={() => {}}
        cost={null}
        venues={venues}
        onPrefill={onPrefill}
      />,
    )
    // Paso 1: costo débito 1.68
    fireEvent.change(screen.getByLabelText(/Débito/i), { target: { value: '1.68' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    // Paso 2: flat 3.5
    fireEvent.click(screen.getByRole('button', { name: /Tasa pareja/i }))
    fireEvent.change(screen.getByLabelText(/% que paga el venue/i), { target: { value: '3.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    // Paso 3: prellenar (venue default ya seleccionado)
    fireEvent.click(screen.getByRole('button', { name: /Prellenar y revisar/i }))
    expect(onPrefill).toHaveBeenCalledTimes(1)
    const arg = onPrefill.mock.calls[0][0]
    expect(arg.venueId).toBe('v1')
    expect(arg.result.venuePricingInput.rates.DEBIT).toBe(0.035)
  })

  it('permite escribir la comisión con decimales (3.5, no 35)', async () => {
    const user = userEvent.setup()
    const onPrefill = vi.fn()
    render(
      <PricingWizardDrawer
        open
        onOpenChange={() => {}}
        cost={null}
        venues={venues}
        onPrefill={onPrefill}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Siguiente/i })) // → paso 2
    await user.click(screen.getByRole('button', { name: /Costo \+ comisión/i }))
    const input = screen.getByLabelText(/Tu comisión/i) as HTMLInputElement
    await user.type(input, '3.5')
    // Antes del fix, el input re-formateaba en cada tecla y el punto se borraba → "35".
    expect(input.value).toBe('3.5')
    await user.click(screen.getByRole('button', { name: /Siguiente/i })) // → paso 3
    // el paso 3 explica el modelo y muestra el desglose por tarjeta (costo → paga el venue → margen)
    expect(screen.getByText(/El venue paga tu costo \+ 3\.5%/i)).toBeTruthy()
    expect(screen.getByText(/Paga el venue/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Prellenar y revisar/i }))
    // cost=null → costo 0; markup 3.5% con IVA (default) → pricing = 0 + 0.035
    expect(onPrefill.mock.calls[0][0].result.venuePricingInput.rates.DEBIT).toBeCloseTo(0.035, 4)
  })

  it('pre-llena el paso 1 con el costo del proveedor (0.67 %, sin IVA)', () => {
    render(
      <PricingWizardDrawer
        open
        onOpenChange={() => {}}
        cost={costoSinIva}
        venues={venues}
        onPrefill={vi.fn()}
      />,
    )
    expectPaso1ConCostoDeAmaena()
  })

  it('siembra el paso 1 al ABRIR, no al montar: el costo que llega después se ve al abrir', () => {
    // Hermano del defecto de «Editar economía» (AMAENA T, 2026-09-14): la página monta el
    // Asistente cerrado en cuanto llega el merchant, ANTES de que cargue el costo. Si el
    // borrador se congela en ese momento, la primera apertura arranca con ceros e IVA
    // marcado aunque la página de fondo ya muestre el costo real.
    const { rerender } = render(
      <PricingWizardDrawer
        open={false}
        onOpenChange={() => {}}
        cost={null}
        venues={[]}
        onPrefill={vi.fn()}
      />,
    )
    expect(screen.queryByText('Asistente de pricing')).not.toBeInTheDocument()

    rerender(
      <PricingWizardDrawer
        open
        onOpenChange={() => {}}
        cost={costoSinIva}
        venues={venues}
        onPrefill={vi.fn()}
      />,
    )
    expect(screen.getByText('Asistente de pricing')).toBeInTheDocument()
    expectPaso1ConCostoDeAmaena()
  })

  it('el venue destino también se siembra al abrir (los venues llegan después de montar)', () => {
    // Mismo defecto, otra cara: `venueId` se sembraba con `venues[0]` cuando la lista aún
    // era `[]` → en el paso 3 nada seleccionado y «Prellenar y revisar» deshabilitado.
    const { rerender } = render(
      <PricingWizardDrawer
        open={false}
        onOpenChange={() => {}}
        cost={null}
        venues={[]}
        onPrefill={vi.fn()}
      />,
    )
    rerender(
      <PricingWizardDrawer
        open
        onOpenChange={() => {}}
        cost={costoSinIva}
        venues={venues}
        onPrefill={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i })) // → paso 2
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i })) // → paso 3
    expect(screen.getByRole('button', { name: 'Venue destino' })).toHaveTextContent('Berthe')
    expect(screen.getByRole('button', { name: /Prellenar y revisar/i })).toBeEnabled()
  })

  it('cada apertura arranca limpia (paso 1, costo guardado) aunque el cierre venga del padre', () => {
    // Antes esto dependía de que el cierre pasara por `onOpenChange` para correr `reset()`;
    // ahora el contenido se desmonta al cerrar, así que lo tecleado y el paso se descartan
    // sin importar quién cerró.
    const { rerender } = render(
      <PricingWizardDrawer
        open
        onOpenChange={() => {}}
        cost={costoSinIva}
        venues={venues}
        onPrefill={vi.fn()}
      />,
    )
    fireEvent.change(input('wiz-cost-DEBIT'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i })) // → paso 2
    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument()

    rerender(
      <PricingWizardDrawer
        open={false}
        onOpenChange={() => {}}
        cost={costoSinIva}
        venues={venues}
        onPrefill={vi.fn()}
      />,
    )
    rerender(
      <PricingWizardDrawer
        open
        onOpenChange={() => {}}
        cost={costoSinIva}
        venues={venues}
        onPrefill={vi.fn()}
      />,
    )
    expectPaso1ConCostoDeAmaena()
  })
})
