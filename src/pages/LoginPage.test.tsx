import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/render'
import { LoginPage } from './LoginPage'

describe('<LoginPage />', () => {
  it('renders the brand mark and form labels', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar a la consola/i })).toBeInTheDocument()
  })

  it('shows the support email link', () => {
    renderWithProviders(<LoginPage />)
    const link = screen.getByRole('link', { name: /ops@avoqado\.io/i })
    expect(link).toHaveAttribute('href', 'mailto:hola@avoqado.io')
  })

  // TODO(test): form validation + mutation flows are flaky in jsdom — RHF + Field ref
  // forwarding needs another look. Cover these via Playwright E2E in e2e/login.spec.ts
  // until we identify the root cause.
})
