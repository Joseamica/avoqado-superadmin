import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test/render'
import { Checkbox } from './Checkbox'

describe('<Checkbox />', () => {
  it('renders unchecked by default', () => {
    renderWithProviders(<Checkbox aria-label="acepto" />)
    const cb = screen.getByRole('checkbox', { name: /acepto/i })
    expect(cb).toHaveAttribute('data-state', 'unchecked')
  })

  it('renders checked when checked=true', () => {
    renderWithProviders(<Checkbox aria-label="ok" checked onCheckedChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: /ok/i })).toHaveAttribute('data-state', 'checked')
  })

  it('renders indeterminate when checked="indeterminate"', () => {
    renderWithProviders(
      <Checkbox aria-label="parcial" checked="indeterminate" onCheckedChange={() => {}} />,
    )
    expect(screen.getByRole('checkbox', { name: /parcial/i })).toHaveAttribute(
      'data-state',
      'indeterminate',
    )
  })

  it('fires onCheckedChange when clicked', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    renderWithProviders(<Checkbox aria-label="click" onCheckedChange={handler} />)
    await user.click(screen.getByRole('checkbox', { name: /click/i }))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not fire onCheckedChange when disabled', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    renderWithProviders(<Checkbox aria-label="block" disabled onCheckedChange={handler} />)
    await user.click(screen.getByRole('checkbox', { name: /block/i }))
    expect(handler).not.toHaveBeenCalled()
  })
})
