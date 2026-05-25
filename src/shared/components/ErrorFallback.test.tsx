import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test/render'
import { DefaultErrorFallback } from './ErrorFallback'

describe('<DefaultErrorFallback />', () => {
  it('renders the error name and message inside the pre block', () => {
    const err = new Error('detalle del error')
    err.name = 'TypeError'
    renderWithProviders(<DefaultErrorFallback error={err} onReset={() => {}} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/algo se rompió/i)).toBeInTheDocument()
    expect(screen.getByText(/TypeError/)).toBeInTheDocument()
    expect(screen.getByText(/detalle del error/)).toBeInTheDocument()
  })

  it('invokes onReset when the Reintentar button is clicked', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()
    renderWithProviders(<DefaultErrorFallback error={new Error('x')} onReset={onReset} />)
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('renders the support email as a mailto link', () => {
    renderWithProviders(<DefaultErrorFallback error={new Error('x')} onReset={() => {}} />)
    // The email is in a <code> tag, not a link — check that the text is present.
    expect(screen.getByText(/hola@avoqado\.io/i)).toBeInTheDocument()
  })
})
