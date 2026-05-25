import { describe, it, expect, vi, beforeAll } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { Combobox, type ComboboxOption } from './Combobox'

// cmdk / Radix Popover use ResizeObserver and scrollIntoView — not available in jsdom.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

const OPTIONS: ComboboxOption[] = [
  { value: 'mx', label: 'México' },
  { value: 'us', label: 'Estados Unidos', description: 'USA' },
  { value: 'es', label: 'España', searchTokens: 'spain europa' },
]

describe('<Combobox />', () => {
  it('renders the placeholder when no value is selected', () => {
    renderWithProviders(
      <Combobox value="" onChange={() => {}} options={OPTIONS} placeholder="Elige un país" />,
    )
    expect(screen.getByRole('button')).toHaveTextContent(/elige un país/i)
  })

  it('shows the selected option label when value matches', () => {
    renderWithProviders(<Combobox value="mx" onChange={() => {}} options={OPTIONS} />)
    expect(screen.getByRole('button')).toHaveTextContent(/méxico/i)
  })

  it('falls back to the raw value when allowCustomValue is on and no option matches', () => {
    renderWithProviders(
      <Combobox value="custom-slug" onChange={() => {}} options={OPTIONS} allowCustomValue />,
    )
    expect(screen.getByRole('button')).toHaveTextContent(/custom-slug/i)
  })

  it('opens the popover and renders options when clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Combobox value="" onChange={() => {}} options={OPTIONS} />)
    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('México')).toBeInTheDocument())
    expect(screen.getByText('Estados Unidos')).toBeInTheDocument()
  })

  it('fires onChange when an option is selected', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    renderWithProviders(<Combobox value="" onChange={handler} options={OPTIONS} />)
    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('México')).toBeInTheDocument())
    await user.click(screen.getByText('México'))
    expect(handler).toHaveBeenCalledWith('mx')
  })

  it('disables the trigger when disabled', () => {
    renderWithProviders(
      <Combobox value="" onChange={() => {}} options={OPTIONS} disabled ariaLabel="combo" />,
    )
    expect(screen.getByRole('button', { name: /combo/i })).toBeDisabled()
  })

  it('uses renderTriggerValue when provided', () => {
    renderWithProviders(
      <Combobox
        value="mx"
        onChange={() => {}}
        options={OPTIONS}
        renderTriggerValue={(v) => <span>render:{v}</span>}
      />,
    )
    expect(screen.getByText('render:mx')).toBeInTheDocument()
  })
})
