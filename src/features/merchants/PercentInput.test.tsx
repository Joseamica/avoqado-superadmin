import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PercentInput } from './PercentInput'

describe('PercentInput', () => {
  it('muestra los decimales de la tasa guardada sin ocultarlos al reabrir', () => {
    render(<PercentInput value={0.012345} onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('1.2345')
  })

  it('acepta coma decimal completa sin truncar y conserva la escritura parcial', () => {
    const changed = vi.fn()
    render(<PercentInput id="pct" value={0.01} onChange={changed} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '1,5' } })
    expect(changed).toHaveBeenLastCalledWith(0.015)
    fireEvent.change(input, { target: { value: '3.' } })
    expect(input).toHaveValue('3.')
    expect(changed).toHaveBeenLastCalledWith(0.03)
  })
  it.each(['abc', '1.5xyz', '1,2,3', '1e2', '-1', '101'])(
    'no envía el formulario con %s ni lo convierte a cero',
    (raw) => {
      const saved = vi.fn((e: React.FormEvent) => e.preventDefault())
      const changed = vi.fn()
      render(
        <form onSubmit={saved}>
          <PercentInput value={0.01} onChange={changed} />
          <button>Guardar</button>
        </form>,
      )
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: raw } })
      fireEvent.click(screen.getByRole('button'))
      expect(input).toBeInvalid()
      expect(saved).not.toHaveBeenCalled()
      expect(changed).not.toHaveBeenCalled()
    },
  )
})
