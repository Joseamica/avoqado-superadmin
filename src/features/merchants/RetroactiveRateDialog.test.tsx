import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderWithProviders, screen, waitFor, within } from '@/test/render'
import userEvent from '@testing-library/user-event'
import { server } from '@/test/mocks/server'
import { RetroactiveRateDialog } from './RetroactiveRateDialog'
import type { CardRates } from './types'

const baseURL = 'http://localhost:3000/api/v1'
const venueId = 'v1'

const newRates: CardRates = { DEBIT: 0.02, CREDIT: 0.03, AMEX: 0.04, INTERNATIONAL: 0.05 }

const previewBody = {
  data: {
    merchantAccountId: 'ma1',
    inScopeCount: 4,
    withCostCount: 4,
    missingCostCount: 0,
    beforeFeeTotal: 10,
    afterFeeTotal: 22.5,
    estimatedImpact: 12.5,
    negativeMarginCount: 0,
    costStructureAvailable: true,
    venuePricingAvailable: true,
  },
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof RetroactiveRateDialog>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    venueId,
    venueName: 'Pez Volador',
    slot: 'PRIMARY' as const,
    newRates,
    includesTax: true,
    taxRate: 0.16,
    fixedFeePerTransaction: null,
    onSaveForward: vi.fn().mockResolvedValue(undefined),
    onDone: vi.fn(),
    ...overrides,
  }
  renderWithProviders(<RetroactiveRateDialog {...props} />)
  return props
}

describe('RetroactiveRateDialog', () => {
  it('renderiza con el checkbox retroactivo OFF y el botón forward "Guardar" visible', () => {
    renderDialog()
    expect(
      screen.getByText('También recalcular las transacciones pasadas con esta tasa'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
    // El hint de forward-only se muestra mientras está OFF.
    expect(screen.getByText(/Por defecto sólo cambia de aquí en adelante/)).toBeInTheDocument()
  })

  it('marcar el checkbox dispara el preview y muestra "Pagos a recalcular: 4"', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${baseURL}/superadmin/rate-corrections/venues/${venueId}/preview`, () =>
        HttpResponse.json(previewBody),
      ),
    )
    renderDialog()

    await user.click(screen.getByText('También recalcular las transacciones pasadas con esta tasa'))

    const label = await screen.findByText('Pagos a recalcular')
    // El valor vive en el mismo Row (label izquierda, número derecha).
    const row = label.parentElement as HTMLElement
    expect(within(row).getByText('4')).toBeInTheDocument()
  })

  it('el botón aplicar está deshabilitado hasta escribir APLICAR; al hacerlo y clickear llama apply y dispara onDone', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${baseURL}/superadmin/rate-corrections/venues/${venueId}/preview`, () =>
        HttpResponse.json(previewBody),
      ),
      http.post(`${baseURL}/superadmin/rate-corrections/venues/${venueId}/apply`, () =>
        HttpResponse.json({
          data: {
            id: 'b1',
            venueId,
            merchantAccountId: 'ma1',
            accountType: 'PRIMARY',
            status: 'APPLIED',
            paymentCount: 4,
            costCreatedCount: 0,
            estimatedImpact: 12.5,
            appliedAt: '2026-05-26T00:00:00.000Z',
            reversedAt: null,
            createdAt: '2026-05-26T00:00:00.000Z',
          },
        }),
      ),
    )
    const props = renderDialog()

    await user.click(screen.getByText('También recalcular las transacciones pasadas con esta tasa'))
    await screen.findByText('Pagos a recalcular')

    const applyBtn = await screen.findByRole('button', { name: /Recalcular 4 pagos/ })
    expect(applyBtn).toBeDisabled()

    await user.type(await screen.findByLabelText('Escribe APLICAR para confirmar'), 'APLICAR')
    expect(applyBtn).toBeEnabled()

    await user.click(applyBtn)

    await waitFor(() => expect(props.onDone).toHaveBeenCalled())
  })
})
