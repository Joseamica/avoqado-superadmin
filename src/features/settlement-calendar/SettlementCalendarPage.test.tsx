import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { installGlobalServer, server } from '@/test/mocks/server'
import { SettlementCalendarPage } from './SettlementCalendarPage'
import type { SettlementCalendar } from './types'

installGlobalServer()

const day = (
  date: string,
  status: 'settled' | 'today' | 'projected',
  venues: SettlementCalendar['days'][0]['venues'],
) => ({
  date,
  status,
  gross: venues.reduce((s, v) => s + v.gross, 0),
  commission: venues.reduce((s, v) => s + v.commission, 0),
  net: venues.reduce((s, v) => s + v.net, 0),
  count: venues.reduce((s, v) => s + v.count, 0),
  venues,
})

const venue = (
  venueId: string,
  venueName: string,
  net: number,
  hasAggregator = false,
  aggregatorNames: string[] = [],
) => ({
  venueId,
  venueName,
  gross: net + 10,
  commission: 10,
  net,
  count: 2,
  hasAggregator,
  aggregatorNames,
})

const CALENDAR: SettlementCalendar = {
  from: '2026-07-01',
  to: '2026-07-31',
  days: [
    day('2026-07-06', 'settled', [venue('v1', 'Mindform', 1000)]),
    day('2026-07-14', 'today', [
      venue('v2', 'Doña Simona', 5000, true, ['Externo']),
      venue('v3', 'IQ', 2000),
    ]),
  ],
  total: { gross: 8030, commission: 30, net: 8000, count: 6 },
  venueCount: 3,
  unprojected: { count: 0, gross: 0 },
}

function mockCalendar(data: Partial<SettlementCalendar> = {}) {
  server.use(
    http.get('*/superadmin/settlement-calendar', () =>
      HttpResponse.json({ success: true, data: { ...CALENDAR, ...data } }),
    ),
  )
}

describe('SettlementCalendarPage', () => {
  beforeEach(() => {
    // Fijamos "hoy" al 14-jul-2026 para que el mes por default sea julio 2026
    // y el día auto-seleccionado sea determinístico.
    vi.useFakeTimers({ shouldAdvanceTime: true }).setSystemTime(new Date('2026-07-14T18:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('muestra el total del mes y el desglose del día de hoy por default', async () => {
    mockCalendar()
    renderWithProviders(<SettlementCalendarPage />)

    expect(await screen.findByText('$8,000.00')).toBeInTheDocument() // KPI total
    expect(screen.getByText('julio 2026')).toBeInTheDocument()

    // Auto-selecciona hoy (14-jul) porque tiene dinero.
    expect(await screen.findByText('14 de julio')).toBeInTheDocument()
    expect(screen.getByText('Cae hoy')).toBeInTheDocument()
    expect(screen.getByText('Doña Simona')).toBeInTheDocument()
    expect(screen.getByText('IQ')).toBeInTheDocument()
    // Mindform cae otro día → no está en el desglose de hoy.
    expect(screen.queryByText('Mindform')).not.toBeInTheDocument()
  })

  it('etiqueta con el agregador sólo al venue que pasa por uno', async () => {
    mockCalendar()
    renderWithProviders(<SettlementCalendarPage />)

    await screen.findByText('Doña Simona')
    expect(screen.getByText('Externo')).toBeInTheDocument()
  })

  it('cambia el desglose al picarle a otro día', async () => {
    mockCalendar()
    // Con fake timers, userEvent DEBE saber cómo avanzarlos: sin esto sus esperas
    // internas nunca resuelven y el test se cae por timeout bajo carga paralela.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithProviders(<SettlementCalendarPage />)

    await screen.findByText('14 de julio')
    await user.click(screen.getByLabelText('6 de julio: $1,000.00 de 1 negocio'))

    expect(await screen.findByText('6 de julio')).toBeInTheDocument()
    expect(screen.getByText('Mindform')).toBeInTheDocument()
    expect(screen.getByText('Ya cayó')).toBeInTheDocument()
  })

  it('no deja picar un día sin depósitos', async () => {
    mockCalendar()
    renderWithProviders(<SettlementCalendarPage />)

    await screen.findByText('14 de julio')
    expect(screen.getByLabelText('7 de julio: sin depósitos')).toBeDisabled()
  })

  // El caso que más importa: dinero sin fechar NO puede desaparecer en silencio,
  // porque el total quedaría corto y nadie sabría por qué.
  it('avisa del dinero que no se pudo ubicar en un día', async () => {
    mockCalendar({ unprojected: { count: 7, gross: 7910.12 } })
    renderWithProviders(<SettlementCalendarPage />)

    expect(await screen.findByText('$7,910.12')).toBeInTheDocument()
    expect(screen.getByText(/no aparece en ningún día/i)).toBeInTheDocument()
  })

  it('enseña qué hace la pantalla cuando el mes viene vacío', async () => {
    mockCalendar({ days: [], total: { gross: 0, commission: 0, net: 0, count: 0 }, venueCount: 0 })
    renderWithProviders(<SettlementCalendarPage />)

    expect(await screen.findByText('No hay depósitos en julio 2026')).toBeInTheDocument()
    expect(screen.getByText(/El efectivo no aparece/i)).toBeInTheDocument()
  })

  it('muestra un error accionable con reintento si el backend falla', async () => {
    server.use(
      http.get('*/superadmin/settlement-calendar', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderWithProviders(<SettlementCalendarPage />)

    expect(await screen.findByRole('button', { name: /reintentar/i })).toBeInTheDocument()
  })

  it('navega al mes anterior', async () => {
    mockCalendar()
    // Con fake timers, userEvent DEBE saber cómo avanzarlos: sin esto sus esperas
    // internas nunca resuelven y el test se cae por timeout bajo carga paralela.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithProviders(<SettlementCalendarPage />)

    await screen.findByText('julio 2026')
    await user.click(screen.getByLabelText('Mes anterior'))
    await waitFor(() => expect(screen.getByText('junio 2026')).toBeInTheDocument())
  })
})
