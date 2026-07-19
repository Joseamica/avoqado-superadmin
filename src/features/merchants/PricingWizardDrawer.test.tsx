import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
})
