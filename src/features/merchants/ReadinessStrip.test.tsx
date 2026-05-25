import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReadinessStrip } from './ReadinessStrip'

describe('ReadinessStrip', () => {
  it('muestra label y estado de cada chip', () => {
    render(
      <ReadinessStrip
        items={[
          { key: 'credentials', label: 'Credenciales', state: 'ok' },
          { key: 'cost', label: 'Costo proveedor', state: 'missing', hint: 'Falta' },
        ]}
      />,
    )
    expect(screen.getByText('Credenciales')).toBeInTheDocument()
    expect(screen.getByText('Costo proveedor')).toBeInTheDocument()
  })
})
