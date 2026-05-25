import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CardRatesInput } from './CardRatesInput'
import type { CardRates } from './types'

const rates: CardRates = { DEBIT: 0.015, CREDIT: 0.025, AMEX: 0.035, INTERNATIONAL: 0.04 }

describe('CardRatesInput', () => {
  it('muestra las tasas como porcentaje', () => {
    render(<CardRatesInput value={rates} onChange={() => {}} idPrefix="cost" />)
    expect((screen.getByLabelText('Débito (%)') as HTMLInputElement).value).toBe('1.5')
    expect((screen.getByLabelText('Crédito (%)') as HTMLInputElement).value).toBe('2.5')
  })

  it('emite decimal al escribir porcentaje', () => {
    const onChange = vi.fn()
    render(<CardRatesInput value={rates} onChange={onChange} idPrefix="cost" />)
    fireEvent.change(screen.getByLabelText('Débito (%)'), { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith({ ...rates, DEBIT: 0.02 })
  })

  it('input vacío = 0', () => {
    const onChange = vi.fn()
    render(<CardRatesInput value={rates} onChange={onChange} idPrefix="cost" />)
    fireEvent.change(screen.getByLabelText('AMEX (%)'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({ ...rates, AMEX: 0 })
  })
})
