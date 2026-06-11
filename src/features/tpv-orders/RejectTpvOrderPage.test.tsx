import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render'
import { server } from '@/test/mocks/server'
import { RejectTpvOrderPage } from './RejectTpvOrderPage'

const baseURL = 'http://localhost:3000/api/v1'

describe('<RejectTpvOrderPage />', () => {
  it('valida el token al montar, acepta el motivo y rechaza el pedido (happy path)', async () => {
    let rejectBody: { reason?: string } | null = null
    server.use(
      http.get(`${baseURL}/public/tpv-orders/ord_1/approve/check`, () =>
        HttpResponse.json({
          success: true,
          data: { orderId: 'ord_1', orderNumber: 'TPV-2026-0042' },
        }),
      ),
      http.post(`${baseURL}/public/tpv-orders/ord_1/reject`, async ({ request }) => {
        rejectBody = (await request.json()) as { reason?: string }
        return HttpResponse.json({
          success: true,
          data: { orderId: 'ord_1', orderNumber: 'TPV-2026-0042' },
        })
      }),
    )

    renderWithProviders(
      <Routes>
        <Route path="/admin/tpv-orders/:id/reject" element={<RejectTpvOrderPage />} />
      </Routes>,
      { initialEntries: ['/admin/tpv-orders/ord_1/reject?token=tok_valido'] },
    )

    // Fase 1: el token se valida con approve/check y aparece el form.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /rechazar pago spei/i })).toBeInTheDocument(),
    )

    // Fase 2: motivo + submit.
    fireEvent.change(screen.getByLabelText(/motivo del rechazo/i), {
      target: { value: 'El monto del comprobante no coincide con el total.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /rechazar y notificar al cliente/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /pedido rechazado/i })).toBeInTheDocument(),
    )
    expect(rejectBody).toEqual({ reason: 'El monto del comprobante no coincide con el total.' })
    expect(screen.getByText(/se envió un email al cliente/i)).toBeInTheDocument()
  })
})
