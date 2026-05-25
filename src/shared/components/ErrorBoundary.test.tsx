import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test/render'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('boom-test')
}

// React/jsdom logs the error to console.error when a boundary catches it —
// silence it for clean test output.
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('<ErrorBoundary />', () => {
  it('renders children when there is no error', () => {
    renderWithProviders(
      <ErrorBoundary>
        <p>todo bien</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText(/todo bien/i)).toBeInTheDocument()
  })

  it('catches a thrown error and renders the default fallback', () => {
    renderWithProviders(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/algo se rompió/i)).toBeInTheDocument()
    expect(screen.getByText(/boom-test/)).toBeInTheDocument()
  })

  it('uses a custom fallback when provided', () => {
    renderWithProviders(
      <ErrorBoundary fallback={(err) => <p>caught: {err.message}</p>}>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/caught: boom-test/i)).toBeInTheDocument()
  })

  it('resets state when the reset callback is invoked', async () => {
    let shouldThrow = true
    function Maybe() {
      if (shouldThrow) throw new Error('boom-test')
      return <p>ya no truena</p>
    }
    const user = userEvent.setup()
    renderWithProviders(
      <ErrorBoundary>
        <Maybe />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    shouldThrow = false
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(screen.getByText(/ya no truena/i)).toBeInTheDocument()
  })
})
