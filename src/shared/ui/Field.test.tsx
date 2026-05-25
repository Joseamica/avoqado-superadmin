import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test/render'
import { Field } from './Field'

describe('<Field />', () => {
  it('renders a label associated with the input by id', () => {
    renderWithProviders(<Field label="Email" name="email" />)
    const input = screen.getByLabelText(/email/i)
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('id', 'email')
  })

  it('renders the hint when no error is set', () => {
    renderWithProviders(<Field label="Email" name="email" hint="Tu correo de trabajo" />)
    expect(screen.getByText(/tu correo de trabajo/i)).toBeInTheDocument()
  })

  it('renders the error message over the hint when both are set', () => {
    renderWithProviders(<Field label="Email" name="email" hint="Pista" error="Campo requerido" />)
    expect(screen.getByText(/campo requerido/i)).toBeInTheDocument()
    expect(screen.queryByText(/pista/i)).not.toBeInTheDocument()
  })

  it('uses an explicit id when provided, otherwise falls back to name', () => {
    const { rerender } = renderWithProviders(<Field label="Una" id="custom" name="x" />)
    expect(screen.getByLabelText(/una/i)).toHaveAttribute('id', 'custom')

    rerender(<Field label="Dos" name="solo-nombre" />)
    expect(screen.getByLabelText(/dos/i)).toHaveAttribute('id', 'solo-nombre')
  })

  it('forwards onChange to the underlying input', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Field label="X" name="x" onChange={onChange} />)
    await user.type(screen.getByLabelText(/x/i), 'a')
    expect(onChange).toHaveBeenCalled()
  })

  it('accepts a forwarded ref', () => {
    let captured: HTMLInputElement | null = null
    function Holder() {
      return (
        <Field
          label="Ref"
          name="ref"
          ref={(el) => {
            captured = el
          }}
        />
      )
    }
    renderWithProviders(<Holder />)
    expect(captured).toBeInstanceOf(HTMLInputElement)
  })
})
