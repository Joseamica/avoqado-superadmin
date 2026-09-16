import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { EditSettlementDrawer } from './EditSettlementDrawer'
import type { SettlementConfiguration } from './types'

const baseURL = 'http://localhost:3000/api/v1'

const settlements: SettlementConfiguration[] = [
  {
    id: 's1',
    merchantAccountId: 'm1',
    cardType: 'DEBIT',
    settlementDays: 1,
    settlementDayType: 'BUSINESS_DAYS',
    cutoffTime: '23:00',
    cutoffTimezone: 'America/Mexico_City',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
  },
]

/**
 * Configuración guardada que difiere de los DEFAULTS en TODO (días, tipo de días y corte).
 * Ojo: los días reales de AMAENA T (1/1/3/3) coinciden con `DEFAULT_DAYS`, así que un test
 * con esos valores pasaría aunque el drawer ignorara lo guardado — sería una prueba que
 * pasa por el motivo equivocado. Por eso aquí 2/3/5/7, naturales y corte 22:30.
 */
const settlementsGuardados: SettlementConfiguration[] = (
  [
    ['DEBIT', 2],
    ['CREDIT', 3],
    ['AMEX', 5],
    ['INTERNATIONAL', 7],
  ] as const
).map(([cardType, settlementDays], i) => ({
  id: `sg${i + 1}`,
  merchantAccountId: 'm1',
  cardType,
  settlementDays,
  settlementDayType: 'CALENDAR_DAYS',
  cutoffTime: '22:30',
  cutoffTimezone: 'America/Mexico_City',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
}))

let capturedPutBody: Record<string, unknown> | null = null

const server = setupServer(
  http.get(`${baseURL}/superadmin/holidays`, () => HttpResponse.json({ data: [] })),
  http.put(`${baseURL}/superadmin/settlement-configurations/s1`, async ({ request }) => {
    capturedPutBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ data: {} })
  }),
  http.post(`${baseURL}/superadmin/settlement-configurations`, () =>
    HttpResponse.json({ data: {} }, { status: 201 }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  capturedPutBody = null
})
afterAll(() => server.close())

describe('EditSettlementDrawer', () => {
  it('renders the drawer with title and card rows', () => {
    renderWithProviders(
      <EditSettlementDrawer
        open
        merchantId="m1"
        settlements={settlements}
        onOpenChange={() => {}}
      />,
    )

    expect(screen.getByText('Editar liquidación')).toBeInTheDocument()
    expect(screen.getByText('Débito')).toBeInTheDocument()
    expect(screen.getByText('Crédito')).toBeInTheDocument()
    expect(screen.getByText('AMEX')).toBeInTheDocument()
    expect(screen.getByText('Internacional')).toBeInTheDocument()
  })

  it('pre-fills the Débito input with the existing settlementDays', () => {
    renderWithProviders(
      <EditSettlementDrawer
        open
        merchantId="m1"
        settlements={settlements}
        onOpenChange={() => {}}
      />,
    )

    const debitInput = screen.getByLabelText('Días Débito') as HTMLInputElement
    expect(debitInput.value).toBe('1')
  })

  it('sends PUT with updated settlementDays when changing Débito to 2 and submitting', async () => {
    renderWithProviders(
      <EditSettlementDrawer
        open
        merchantId="m1"
        settlements={settlements}
        onOpenChange={() => {}}
      />,
    )

    // Change the Días Débito input from 1 to 2
    const debitInput = screen.getByLabelText('Días Débito')
    fireEvent.change(debitInput, { target: { value: '2' } })

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.click(submitBtn)

    // Wait for the PUT body to be captured
    await waitFor(() => {
      expect(capturedPutBody).not.toBeNull()
    })

    // Assert the captured PUT body has settlementDays === 2
    expect(capturedPutBody!.settlementDays).toBe(2)
  })

  /** Lo que tiene que verse con `settlementsGuardados` (ver arriba). */
  function expectGuardadosHidratados() {
    const dias = (card: string) => (screen.getByLabelText(`Días ${card}`) as HTMLInputElement).value
    expect(dias('Débito')).toBe('2')
    expect(dias('Crédito')).toBe('3')
    expect(dias('AMEX')).toBe('5')
    expect(dias('Internacional')).toBe('7')
    // El Combobox pinta el label de la opción elegida dentro de su trigger.
    expect(screen.getByRole('button', { name: 'Tipo de días Débito' })).toHaveTextContent(
      'Naturales',
    )
    expect(screen.getByRole('button', { name: 'Tipo de días AMEX' })).toHaveTextContent('Naturales')
    expect((screen.getByLabelText('Corte') as HTMLInputElement).value).toBe('22:30')
  }

  it('siembra el formulario al ABRIR, no al montar: los settlements que llegan después se ven al abrir', () => {
    // Mismo defecto que «Editar economía» (2026-09-14): la página monta el drawer cerrado en
    // cuanto llega el merchant, ANTES de que cargue la query de liquidación. Si el borrador se
    // congela con `settlements = []`, al abrir se ven los defaults (D+1/1/3/3 hábiles, 23:00)
    // y guardar desde ahí pisa la configuración real.
    const { rerender } = renderWithProviders(
      <EditSettlementDrawer
        open={false}
        merchantId="m1"
        settlements={[]}
        onOpenChange={() => {}}
      />,
    )
    expect(screen.queryByText('Editar liquidación')).not.toBeInTheDocument()

    rerender(
      <EditSettlementDrawer
        open
        merchantId="m1"
        settlements={settlementsGuardados}
        onOpenChange={() => {}}
      />,
    )
    expect(screen.getByText('Editar liquidación')).toBeInTheDocument()
    expectGuardadosHidratados()
  })

  it('cada apertura vuelve a sembrar desde lo guardado (cerrar descarta lo tecleado)', () => {
    const { rerender } = renderWithProviders(
      <EditSettlementDrawer
        open
        merchantId="m1"
        settlements={settlementsGuardados}
        onOpenChange={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText('Días Débito'), { target: { value: '9' } })
    expect((screen.getByLabelText('Días Débito') as HTMLInputElement).value).toBe('9')

    rerender(
      <EditSettlementDrawer
        open={false}
        merchantId="m1"
        settlements={settlementsGuardados}
        onOpenChange={() => {}}
      />,
    )
    rerender(
      <EditSettlementDrawer
        open
        merchantId="m1"
        settlements={settlementsGuardados}
        onOpenChange={() => {}}
      />,
    )
    expectGuardadosHidratados()
  })
})
