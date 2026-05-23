import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test/render'
import { Button } from './Button'

describe('<Button />', () => {
  it('renders its children', () => {
    renderWithProviders(<Button>Aceptar</Button>)
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument()
  })

  it('dispatches onClick when clicked', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    renderWithProviders(<Button onClick={handler}>Enviar</Button>)
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not dispatch onClick when disabled', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    renderWithProviders(
      <Button onClick={handler} disabled>
        Bloqueado
      </Button>,
    )
    await user.click(screen.getByRole('button', { name: 'Bloqueado' }))
    expect(handler).not.toHaveBeenCalled()
  })

  it('renders different variants without crashing', () => {
    const { rerender } = renderWithProviders(<Button variant="primary">A</Button>)
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    rerender(<Button variant="secondary">B</Button>)
    rerender(<Button variant="ghost">C</Button>)
    rerender(<Button variant="danger">D</Button>)
    expect(screen.getByRole('button', { name: 'D' })).toBeInTheDocument()
  })
})
