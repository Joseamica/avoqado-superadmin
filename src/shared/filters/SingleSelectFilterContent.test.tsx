import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test/render'
import { SingleSelectFilterContent, type SingleSelectOption } from './SingleSelectFilterContent'

type Range = 'today' | 'week' | 'month'

const OPTIONS: SingleSelectOption<Range>[] = [
  { value: 'today', label: 'Hoy', description: 'últimas 24 horas' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
]

describe('<SingleSelectFilterContent />', () => {
  it('renders the title and options as radios', () => {
    renderWithProviders(
      <SingleSelectFilterContent
        title="Rango"
        options={OPTIONS}
        selected="today"
        onChange={() => {}}
      />,
    )
    expect(screen.getByText(/rango/i)).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('marks the selected option with aria-checked=true', () => {
    renderWithProviders(
      <SingleSelectFilterContent
        title="Rango"
        options={OPTIONS}
        selected="week"
        onChange={() => {}}
      />,
    )
    const radios = screen.getAllByRole('radio')
    const week = radios.find((r) => /semana/i.test(r.textContent ?? ''))
    expect(week).toHaveAttribute('aria-checked', 'true')
  })

  it('fires onChange and onClose on selection', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(
      <SingleSelectFilterContent
        title="Rango"
        options={OPTIONS}
        selected="today"
        onChange={onChange}
        onClose={onClose}
      />,
    )
    await user.click(screen.getByText(/este mes/i))
    expect(onChange).toHaveBeenCalledWith('month')
    expect(onClose).toHaveBeenCalled()
  })

  it('renders the optional description under the label', () => {
    renderWithProviders(
      <SingleSelectFilterContent
        title="Rango"
        options={OPTIONS}
        selected="today"
        onChange={() => {}}
      />,
    )
    expect(screen.getByText(/últimas 24 horas/i)).toBeInTheDocument()
  })
})
