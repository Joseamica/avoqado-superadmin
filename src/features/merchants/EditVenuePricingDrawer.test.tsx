import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
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
let capturedPutBody: Record<string, unknown> | null = null

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
  capturedPutBody = null
})
afterAll(() => server.close())

describe('EditVenuePricingDrawer', () => {
  it('envía el body correcto al guardar pricing nuevo (POST)', async () => {
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    renderWithProviders(
      <EditVenuePricingDrawer
        open
        venueId="v1"
        venueName="Doña Simona"
        slot="PRIMARY"
        cost={cost}
        onSaved={onSaved}
        onOpenChange={onOpenChange}
      />,
    )

    // Esperar a que los inputs aparezcan (query de active-pricing resuelta)
    await waitFor(() => expect(screen.getByLabelText('Débito (%)')).toBeInTheDocument())

    // Cambiar "Débito (%)" a 3 (3% → 0.03 en decimal)
    const debitInput = screen.getByLabelText('Débito (%)')
    fireEvent.change(debitInput, { target: { value: '3' } })

    // Hacer click en el "Guardar" del drawer — abre el RetroactiveRateDialog
    const drawerGuardar = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.click(drawerGuardar)

    // El diálogo de confirmación debe aparecer
    const dialog = await screen.findByRole('dialog')

    // Hacer click en el "Guardar" dentro del diálogo (forward-only, retro OFF por default)
    const dialogGuardar = within(dialog).getByRole('button', { name: 'Guardar' })
    fireEvent.click(dialogGuardar)

    // Esperar a que se capture el body del POST
    await waitFor(() => {
      expect(capturedPostBody).not.toBeNull()
    })

    // Aserciones sobre el body capturado
    expect(capturedPostBody!.debitRate).toBe(0.03)
    expect(capturedPostBody!.accountType).toBe('PRIMARY')
    expect(capturedPostBody!.venueId).toBe('v1')
    expect(typeof capturedPostBody!.effectiveFrom).toBe('string')

    // onSaved y cierre del drawer se disparan tras éxito
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(onOpenChange).toHaveBeenCalledWith(false)
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

  // Regresión: el campo editable debe mostrar la tasa CRUDA guardada, no la
  // efectiva (×1.16). Si seedeamos con la efectiva, escribir 10 + guardar
  // re-muestra 11.6 en cada reload (el bug reportado por ops).
  describe('round-trip IVA (idempotencia)', () => {
    function withExistingPricing() {
      server.use(
        // Pricing existente: tasa CRUDA 10%, includesTax=false → PUT path
        http.get(`${baseURL}/superadmin/venue-pricing/structures/active/v1/SECONDARY`, () =>
          HttpResponse.json({
            data: {
              id: 'vp-existing',
              debitRate: 0.1,
              creditRate: 0.1,
              amexRate: 0.1,
              internationalRate: 0.1,
              includesTax: false,
              taxRate: 0.16,
              fixedFeePerTransaction: null,
              monthlyServiceFee: null,
              effectiveFrom: '2026-01-01T00:00:00.000Z',
              effectiveTo: null,
              active: true,
            },
          }),
        ),
        http.put(
          `${baseURL}/superadmin/venue-pricing/structures/vp-existing`,
          async ({ request }) => {
            capturedPutBody = (await request.json()) as Record<string, unknown>
            return HttpResponse.json({ data: { id: 'vp-existing' } })
          },
        ),
      )
    }

    it('muestra la tasa cruda (10), no la efectiva con IVA (11.6)', async () => {
      withExistingPricing()
      renderWithProviders(
        <EditVenuePricingDrawer
          open
          venueId="v1"
          venueName="Amaena"
          slot="SECONDARY"
          cost={cost}
          onOpenChange={() => {}}
        />,
      )

      const debitInput = await screen.findByLabelText<HTMLInputElement>('Débito (%)')
      expect(debitInput.value).toBe('10')
    })

    it('guarda la tasa cruda sin doblar el IVA al volver a guardar', async () => {
      withExistingPricing()
      renderWithProviders(
        <EditVenuePricingDrawer
          open
          venueId="v1"
          venueName="Amaena"
          slot="SECONDARY"
          cost={cost}
          onOpenChange={() => {}}
        />,
      )

      // Esperar a que cargue el pricing existente
      await screen.findByLabelText('Débito (%)')

      // Paso 1: click en "Guardar" del drawer → abre el diálogo
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

      // Paso 2: click en "Guardar" dentro del diálogo (forward-only, retro OFF)
      const dialog = await screen.findByRole('dialog')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

      await waitFor(() => expect(capturedPutBody).not.toBeNull())
      // Sin tocar nada, debe re-enviar 0.10 crudo (no 0.116).
      expect(capturedPutBody!.debitRate).toBe(0.1)
      expect(capturedPutBody!.includesTax).toBe(false)
    })
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
