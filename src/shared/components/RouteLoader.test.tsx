import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RouteLoader } from './RouteLoader'

describe('RouteLoader', () => {
  it('renderiza el loading state con role status', () => {
    render(<RouteLoader />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })
})
