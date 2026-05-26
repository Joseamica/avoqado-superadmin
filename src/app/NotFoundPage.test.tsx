import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('renderiza el mensaje 404 y link al dashboard', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('404 · ruta inexistente')).toBeInTheDocument()
    expect(screen.getByText('No la encontramos.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /volver al resumen/i })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })
})
