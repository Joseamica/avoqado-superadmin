import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PricingWizardDrawer } from './PricingWizardDrawer'

const venues = [{ venueId: 'v1', venueName: 'Berthe', slot: 'SECONDARY' as const }]

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
})
