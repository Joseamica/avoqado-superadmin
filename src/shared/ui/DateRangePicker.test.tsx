import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateTime } from 'luxon'
import { DateRangePicker, formatDateRangeLabel, type DateRangeValue } from './DateRangePicker'

// Pin timezone para determinismo.
vi.stubEnv('TZ', 'America/Mexico_City')

const EMPTY_RANGE: DateRangeValue = {}

describe('DateRangePicker', () => {
  it('renderiza el dual calendar con dos meses', () => {
    render(<DateRangePicker value={EMPTY_RANGE} onApply={() => {}} />)

    const picker = screen.getByTestId('date-range-picker')
    // Dos grillas de 7 columnas con weekday headers
    const luHeaders = within(picker).getAllByText('lu')
    expect(luHeaders).toHaveLength(2)
  })

  it('muestra placeholders cuando no hay range', () => {
    render(<DateRangePicker value={EMPTY_RANGE} onApply={() => {}} />)

    expect(screen.getByText('Fecha inicio')).toBeInTheDocument()
    expect(screen.getByText('Fecha fin')).toBeInTheDocument()
  })

  it('muestra fechas formateadas cuando hay range', () => {
    const value: DateRangeValue = {
      startTime: '2026-05-20T12:00:00.000Z',
      endTime: '2026-05-25T18:00:00.000Z',
    }
    render(<DateRangePicker value={value} onApply={() => {}} />)

    // Header debería mostrar "20 / 5 / 2026" y "25 / 5 / 2026"
    expect(screen.getByText('20 / 5 / 2026')).toBeInTheDocument()
    expect(screen.getByText('25 / 5 / 2026')).toBeInTheDocument()
  })

  it('renderiza presets cuando se proporcionan', () => {
    const presets = [
      { label: '1h', hours: 1 },
      { label: '24h', hours: 24 },
    ]
    render(<DateRangePicker value={EMPTY_RANGE} onApply={() => {}} presets={presets} />)

    expect(screen.getByText('1h')).toBeInTheDocument()
    expect(screen.getByText('24h')).toBeInTheDocument()
  })

  it('preset aplica inmediatamente con onApply + onClose', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const onClose = vi.fn()
    const presets = [{ label: '1h', hours: 1 }]

    render(
      <DateRangePicker value={EMPTY_RANGE} onApply={onApply} onClose={onClose} presets={presets} />,
    )

    await user.click(screen.getByText('1h'))

    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    // El range del preset solo tiene startTime (sin endTime).
    const range = onApply.mock.calls[0][0] as DateRangeValue
    expect(range.startTime).toBeDefined()
    expect(range.endTime).toBeUndefined()
  })

  it('seleccionar un día lo marca como inicio', async () => {
    const user = userEvent.setup()
    render(<DateRangePicker value={EMPTY_RANGE} onApply={() => {}} />)

    // Buscar un día "15" en el primer calendar (puede haber dos "15" — uno por mes).
    const dayButtons = screen.getAllByText('15')
    const clickable = dayButtons.find((b) => b.closest('button')?.getAttribute('tabindex') === '0')
    if (clickable) {
      await user.click(clickable)
      // Después de un click, el header debería mostrar la fecha (no "Fecha inicio").
      expect(screen.queryByText('Fecha inicio')).not.toBeInTheDocument()
    }
  })

  it('"Limpiar" llama onApply con range vacío y cierra', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const onClose = vi.fn()
    const value: DateRangeValue = {
      startTime: '2026-05-20T12:00:00.000Z',
      endTime: '2026-05-25T18:00:00.000Z',
    }

    render(<DateRangePicker value={value} onApply={onApply} onClose={onClose} />)
    await user.click(screen.getByText('Limpiar'))

    expect(onApply).toHaveBeenCalledWith({})
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renderiza time inputs cuando showTime=true', () => {
    render(<DateRangePicker value={EMPTY_RANGE} onApply={() => {}} showTime />)

    expect(screen.getByText('Hora inicio')).toBeInTheDocument()
    expect(screen.getByText('Hora fin')).toBeInTheDocument()
  })

  it('no renderiza time inputs por default', () => {
    render(<DateRangePicker value={EMPTY_RANGE} onApply={() => {}} />)

    expect(screen.queryByText('Hora inicio')).not.toBeInTheDocument()
  })

  it('tiene botones de navegación de mes', () => {
    render(<DateRangePicker value={EMPTY_RANGE} onApply={() => {}} />)

    expect(screen.getByLabelText('Mes anterior')).toBeInTheDocument()
    expect(screen.getByLabelText('Mes siguiente')).toBeInTheDocument()
  })

  it('muestra hint de maxDaysBack cuando se proporciona', () => {
    render(
      <DateRangePicker
        value={EMPTY_RANGE}
        onApply={() => {}}
        maxDaysBack={30}
        maxDaysBackHint="Render retiene logs por máximo 30 días."
      />,
    )

    expect(screen.getByText('Render retiene logs por máximo 30 días.')).toBeInTheDocument()
  })

  it('deshabilita días anteriores a maxDaysBack', () => {
    // Con maxDaysBack=7, días de hace más de 7 días deben estar disabled.
    render(<DateRangePicker value={EMPTY_RANGE} onApply={() => {}} maxDaysBack={7} />)

    const picker = screen.getByTestId('date-range-picker')
    const allButtons = within(picker).getAllByRole('button')
    // Al menos algunos botones del calendar deben estar disabled (los old days).
    const disabledDayButtons = allButtons.filter(
      (b) =>
        (b as HTMLButtonElement).disabled && b.getAttribute('aria-label')?.match(/\d+ \w+ \d+/),
    )
    expect(disabledDayButtons.length).toBeGreaterThan(0)
  })
})

describe('formatDateRangeLabel', () => {
  it('devuelve null sin range', () => {
    expect(formatDateRangeLabel({})).toBeNull()
  })

  it('devuelve "Última hora" para preset de 1h', () => {
    const start = DateTime.now()
      .setZone('America/Mexico_City')
      .minus({ minutes: 50 })
      .toUTC()
      .toISO()!
    expect(formatDateRangeLabel({ startTime: start })).toBe('Última hora')
  })

  it('devuelve "Últimas 24h" para preset de 24h', () => {
    const start = DateTime.now()
      .setZone('America/Mexico_City')
      .minus({ hours: 23 })
      .toUTC()
      .toISO()!
    expect(formatDateRangeLabel({ startTime: start })).toBe('Últimas 24h')
  })

  it('devuelve rango compacto para range explícito', () => {
    const label = formatDateRangeLabel({
      startTime: '2026-05-20T12:00:00.000Z',
      endTime: '2026-05-25T18:00:00.000Z',
    })
    expect(label).toContain('→')
    expect(label).toContain('20/05')
    expect(label).toContain('25/05')
  })
})
