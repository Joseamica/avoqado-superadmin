import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { installGlobalServer, server } from '@/test/mocks/server'
import { renderWithProviders } from '@/test/render'
import { AngelPaySetupPanel } from './AngelPaySetupPanel'

installGlobalServer()

describe('AngelPaySetupPanel', () => {
  it('renderiza el panel con su título, las cards y el CTA deshabilitado', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/dashboard/superadmin/venues', () =>
        HttpResponse.json({
          success: true,
          data: [{ id: 'v1', name: 'Doña Simona', slug: 'x' }],
        }),
      ),
    )

    renderWithProviders(<AngelPaySetupPanel />)

    expect(screen.getByText('Nuevo merchant AngelPay')).toBeInTheDocument()
    expect(screen.getByText('Cuenta AngelPay')).toBeInTheDocument()
    expect(screen.getByText('Merchant')).toBeInTheDocument()

    // CTA arranca deshabilitado (faltan obligatorias)
    expect(screen.getByRole('button', { name: /Activar merchant/ })).toBeDisabled()
  })
})
