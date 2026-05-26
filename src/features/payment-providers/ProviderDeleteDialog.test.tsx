import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { ProviderDeleteDialog } from './ProviderDeleteDialog'

const baseURL = 'http://localhost:3000/api/v1'

let forceDeleteCalled = false

function blockers(canDelete: boolean) {
  return {
    code: 'MENTA',
    name: 'Menta',
    merchants: canDelete ? [] : [{ id: 'm1', label: 'Cuenta X' }],
    ecommerceMerchants: canDelete ? [] : [{ id: 'e1', label: 'Amaena · canal', removable: true }],
    webhooks: 0,
    eventLogs: 0,
    costStructures: 0,
    canDelete,
  }
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  forceDeleteCalled = false
})
afterAll(() => server.close())

describe('ProviderDeleteDialog', () => {
  it('con bloqueadores: los lista y deshabilita "Borrar definitivamente"', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/p1/blockers`, () =>
        HttpResponse.json({ success: true, data: blockers(false) }),
      ),
    )
    renderWithProviders(
      <ProviderDeleteDialog
        open
        onOpenChange={() => {}}
        providerId="p1"
        providerName="Menta"
        onDeleted={() => {}}
      />,
    )
    expect(await screen.findByText('Cuentas merchant')).toBeInTheDocument()
    expect(screen.getByText('Cuenta X')).toBeInTheDocument()
    expect(screen.getByText('Canales e-commerce')).toBeInTheDocument()
    expect(screen.getByText('Amaena · canal')).toBeInTheDocument()
    const del = screen.getByRole('button', { name: /Borrar definitivamente/ })
    expect(del).toBeDisabled()
  })

  it('canal e-commerce con historial se muestra como no-removible (sin botón Quitar)', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/p1/blockers`, () =>
        HttpResponse.json({
          success: true,
          data: {
            code: 'MENTA',
            name: 'Menta',
            merchants: [],
            ecommerceMerchants: [
              {
                id: 'e1',
                label: 'Amaena · canal',
                removable: false,
                reason: '4 sesión(es) · 1 link(s)',
              },
            ],
            webhooks: 0,
            eventLogs: 0,
            costStructures: 0,
            canDelete: false,
          },
        }),
      ),
    )
    renderWithProviders(
      <ProviderDeleteDialog
        open
        onOpenChange={() => {}}
        providerId="p1"
        providerName="Menta"
        onDeleted={() => {}}
      />,
    )
    expect(await screen.findByText(/con historial/)).toBeInTheDocument()
    expect(screen.getByText('4 sesión(es) · 1 link(s)')).toBeInTheDocument()
    // No hay botón "Quitar" para ese canal; sí está "Desactivar" como salida.
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Desactivar/ })).toBeInTheDocument()
  })

  it('expandir un merchant muestra sus bloqueadores (terminales con "Desasignar")', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/p1/blockers`, () =>
        HttpResponse.json({ success: true, data: blockers(false) }),
      ),
      http.get(`${baseURL}/superadmin/merchant-accounts/m1/blockers`, () =>
        HttpResponse.json({
          success: true,
          data: {
            displayName: 'Cuenta X',
            payments: 0,
            transactionCosts: 0,
            costStructures: [],
            venueConfigs: [],
            terminals: [{ id: 't1', name: 'TPV 1', serialNumber: 'AVQD-1' }],
            canDelete: false,
          },
        }),
      ),
    )
    renderWithProviders(
      <ProviderDeleteDialog
        open
        onOpenChange={() => {}}
        providerId="p1"
        providerName="Menta"
        onDeleted={() => {}}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: /Cuenta X/ }))
    expect(await screen.findByText('Terminales que lo procesan')).toBeInTheDocument()
    expect(screen.getByText('AVQD-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desasignar' })).toBeInTheDocument()
  })

  it('sin bloqueadores: permite el borrado real y llama onDeleted', async () => {
    const onDeleted = vi.fn()
    server.use(
      http.get(`${baseURL}/superadmin/payment-providers/p1/blockers`, () =>
        HttpResponse.json({ success: true, data: blockers(true) }),
      ),
      http.delete(`${baseURL}/superadmin/payment-providers/p1`, ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('force') === 'true') forceDeleteCalled = true
        return HttpResponse.json({ success: true })
      }),
    )
    renderWithProviders(
      <ProviderDeleteDialog
        open
        onOpenChange={() => {}}
        providerId="p1"
        providerName="Menta"
        onDeleted={onDeleted}
      />,
    )
    const del = await screen.findByRole('button', { name: /Borrar definitivamente/ })
    await waitFor(() => expect(del).not.toBeDisabled())
    fireEvent.click(del)
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
    expect(forceDeleteCalled).toBe(true)
  })
})
