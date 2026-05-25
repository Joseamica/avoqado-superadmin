import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { EditVenuePricingDrawer } from './EditVenuePricingDrawer'
import type { ProviderCostStructure } from './types'

const baseURL = 'http://localhost:3000/api/v1'

const cost: ProviderCostStructure = {
  id: 'c1',
  merchantAccountId: 'm1',
  debitRate: 0.015,
  creditRate: 0.025,
  amexRate: 0.035,
  internationalRate: 0.04,
  includesTax: true,
  taxRate: 0.16,
  fixedCostPerTransaction: null,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  active: true,
}

let capturedPostBody: Record<string, unknown> | null = null

const server = setupServer(
  // No existing pricing → POST path
  http.get(`${baseURL}/superadmin/venue-pricing/structures/active/v1/PRIMARY`, () =>
    HttpResponse.json({ data: null }),
  ),
  http.post(`${baseURL}/superadmin/venue-pricing/structures`, async ({ request }) => {
    capturedPostBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ data: { id: 'vp1' } }, { status: 201 })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  capturedPostBody = null
})
afterAll(() => server.close())

describe('EditVenuePricingDrawer', () => {
  it('envía el body correcto al guardar pricing nuevo (POST)', async () => {
    renderWithProviders(
      <EditVenuePricingDrawer
        open
        venueId="v1"
        venueName="Doña Simona"
        slot="PRIMARY"
        cost={cost}
        onOpenChange={() => {}}
      />,
    )

    // Esperar a que los inputs aparezcan (query de active-pricing resuelta)
    await waitFor(() => expect(screen.getByLabelText('Débito (%)')).toBeInTheDocument())

    // Cambiar "Débito (%)" a 3 (3% → 0.03 en decimal)
    const debitInput = screen.getByLabelText('Débito (%)')
    fireEvent.change(debitInput, { target: { value: '3' } })

    // Enviar el form
    const submitBtn = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.click(submitBtn)

    // Esperar a que se capture el body del POST
    await waitFor(() => {
      expect(capturedPostBody).not.toBeNull()
    })

    // Aserciones sobre el body capturado
    expect(capturedPostBody!.debitRate).toBe(0.03)
    expect(capturedPostBody!.accountType).toBe('PRIMARY')
    expect(capturedPostBody!.venueId).toBe('v1')
    expect(typeof capturedPostBody!.effectiveFrom).toBe('string')
  })

  it('muestra el título con el nombre del venue', async () => {
    renderWithProviders(
      <EditVenuePricingDrawer
        open
        venueId="v1"
        venueName="Doña Simona"
        slot="PRIMARY"
        cost={cost}
        onOpenChange={() => {}}
      />,
    )

    expect(screen.getByText('Pricing · Doña Simona')).toBeInTheDocument()
    expect(screen.getByText(/slot PRIMARY/)).toBeInTheDocument()
  })

  it('muestra estado de carga mientras resuelve el pricing activo', () => {
    // No hay handlers configurados para este test → el GET queda pendiente
    server.use(
      http.get(
        `${baseURL}/superadmin/venue-pricing/structures/active/v1/PRIMARY`,
        () =>
          new Promise(() => {
            // nunca resuelve → loading state
          }),
      ),
    )

    renderWithProviders(
      <EditVenuePricingDrawer
        open
        venueId="v1"
        venueName="Doña Simona"
        slot="PRIMARY"
        cost={cost}
        onOpenChange={() => {}}
      />,
    )

    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })
})
