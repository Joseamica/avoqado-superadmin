import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test/render'
import { QueryError } from './QueryError'

describe('<QueryError />', () => {
  it('renders an alert with a generic title for an unknown error', () => {
    renderWithProviders(<QueryError error={new Error('something')} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows the error message inside the description for a generic Error', () => {
    renderWithProviders(<QueryError error={new Error('mensaje específico')} context="cargar" />)
    expect(document.body.textContent).toMatch(/mensaje específico/i)
  })

  it('shows a Reintentar button when onRetry is provided', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    renderWithProviders(<QueryError error={new Error('x')} onRetry={onRetry} />)
    const btn = screen.getByRole('button', { name: /reintentar/i })
    await user.click(btn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('disables the retry button while isRetrying', () => {
    renderWithProviders(<QueryError error={new Error('x')} onRetry={() => {}} isRetrying />)
    expect(screen.getByRole('button', { name: /reintentando…/i })).toBeDisabled()
  })

  it('hides the retry button when no onRetry is passed', () => {
    renderWithProviders(<QueryError error={new Error('x')} />)
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument()
  })

  it('respects the className prop', () => {
    const { container } = renderWithProviders(
      <QueryError error={new Error('x')} className="custom" />,
    )
    expect(container.querySelector('.custom')).not.toBeNull()
  })
})
