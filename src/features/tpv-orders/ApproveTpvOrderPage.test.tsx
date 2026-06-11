import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { server } from '@/test/mocks/server'
import { ApproveTpvOrderPage } from './ApproveTpvOrderPage'

const baseURL = 'http://localhost:3000/api/v1'

function renderApprovePage(entry: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/tpv-orders/:id/approve" element={<ApproveTpvOrderPage />} />
    </Routes>,
    { initialEntries: [entry] },
  )
}

describe('<ApproveTpvOrderPage />', () => {
  it('aprueba el pedido al montar y muestra el orderNumber cuando el endpoint responde 200', async () => {
    let receivedToken: string | null = null
    server.use(
      http.get(`${baseURL}/public/tpv-orders/ord_1/approve`, ({ request }) => {
        receivedToken = new URL(request.url).searchParams.get('token')
        return HttpResponse.json({
          success: true,
          data: { orderId: 'ord_1', orderNumber: 'TPV-2026-0042' },
        })
      }),
    )

    renderApprovePage('/admin/tpv-orders/ord_1/approve?token=tok_valido')

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /pedido aprobado/i })).toBeInTheDocument(),
    )
    expect(receivedToken).toBe('tok_valido')
    expect(screen.getByText('TPV-2026-0042')).toBeInTheDocument()
    expect(screen.getByText(/puedes cerrar esta pestaña/i)).toBeInTheDocument()
  })

  it('muestra el estado de error con el mensaje del servidor cuando el token es inválido o expiró (401)', async () => {
    server.use(
      http.get(`${baseURL}/public/tpv-orders/ord_1/approve`, () =>
        HttpResponse.json({ error: 'El link de aprobación expiró.' }, { status: 401 }),
      ),
    )

    renderApprovePage('/admin/tpv-orders/ord_1/approve?token=tok_expirado')

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /no pudimos aprobar el pedido/i }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText('El link de aprobación expiró.')).toBeInTheDocument()
    expect(screen.getByText(/inicia sesión como superadmin/i)).toBeInTheDocument()
  })
})
