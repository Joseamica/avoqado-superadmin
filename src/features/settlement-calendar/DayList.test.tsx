import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DayList } from './DayList'
import type { CalendarDay } from './types'

const venue = (venueId: string, venueName: string, net: number) => ({
  venueId,
  venueName,
  gross: net,
  commission: 0,
  net,
  count: 1,
  hasAggregator: false,
  aggregatorNames: [],
})

const days: CalendarDay[] = [
  {
    date: '2026-07-06',
    status: 'settled',
    gross: 1000,
    commission: 0,
    net: 1000,
    count: 1,
    venues: [venue('v1', 'Mindform', 1000)],
  },
  {
    date: '2026-07-14',
    status: 'today',
    gross: 22400,
    commission: 0,
    net: 22400,
    count: 2,
    venues: [venue('v2', 'Doña Simona', 20000), venue('v3', 'IQ', 2400)],
  },
]

describe('DayList (vista móvil)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true }).setSystemTime(new Date('2026-07-14T18:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  // La razón de existir de este componente: en móvil el grid trunca el monto a
  // "$…". Acá el monto DEBE leerse completo — si esto se rompe, la vista móvil
  // vuelve a no servir para nada.
  it('muestra el monto completo, no truncado', () => {
    render(<DayList days={days} selected={null} onSelect={() => {}} />)
    expect(screen.getByText('$22,400.00')).toBeInTheDocument()
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
  })

  it('marca el día de hoy y cuenta los negocios', () => {
    render(<DayList days={days} selected={null} onSelect={() => {}} />)
    expect(screen.getByText('hoy')).toBeInTheDocument()
    expect(screen.getByText('mar 14')).toBeInTheDocument()
    expect(screen.getByText('2 negocios')).toBeInTheDocument()
    expect(screen.getByText('1 negocio')).toBeInTheDocument()
  })

  it('avisa cuál está seleccionado y notifica al picar', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<DayList days={days} selected={'2026-07-14'} onSelect={onSelect} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false')

    await user.click(buttons[0])
    expect(onSelect).toHaveBeenCalledWith('2026-07-06')
  })
})
