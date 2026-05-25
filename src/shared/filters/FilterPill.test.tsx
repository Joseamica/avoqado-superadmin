import { describe, it, expect, vi, beforeAll } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { FilterPill, FilterPopoverFooter, FilterPopoverHeader } from './FilterPill'

// Radix Popover uses ResizeObserver — not available in jsdom.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
  }
})

describe('<FilterPill /> (inactive)', () => {
  it('renders the "+ Etiqueta" CTA when no value is active', () => {
    renderWithProviders(
      <FilterPill label="Estado">
        <p>contenido</p>
      </FilterPill>,
    )
    expect(screen.getByRole('button')).toHaveTextContent(/estado/i)
  })

  it('opens the popover when clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <FilterPill label="Estado">
        <p>contenido-popover</p>
      </FilterPill>,
    )
    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('contenido-popover')).toBeInTheDocument())
  })
})

describe('<FilterPill /> (active)', () => {
  it('shows activeLabel when provided', () => {
    renderWithProviders(
      <FilterPill label="Estado" activeLabel="Activos" activeCount={3}>
        <p>x</p>
      </FilterPill>,
    )
    expect(screen.getByRole('button')).toHaveTextContent(/Activos/)
  })

  it('falls back to the count when no activeLabel is given', () => {
    renderWithProviders(
      <FilterPill label="Estado" activeCount={2}>
        <p>x</p>
      </FilterPill>,
    )
    expect(screen.getByRole('button')).toHaveTextContent('2')
  })

  it('fires onClear when the X is clicked (without opening the popover)', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    renderWithProviders(
      <FilterPill label="Estado" activeLabel="A" onClear={onClear}>
        <p>oculto</p>
      </FilterPill>,
    )
    const clearBtn = screen.getByRole('button', { name: /Limpiar filtro de estado/i })
    await user.click(clearBtn)
    expect(onClear).toHaveBeenCalledTimes(1)
    // popover content should NOT be present
    expect(screen.queryByText('oculto')).not.toBeInTheDocument()
  })

  it('fires onClear when Enter is pressed on the X', async () => {
    const onClear = vi.fn()
    renderWithProviders(
      <FilterPill label="Estado" activeLabel="A" onClear={onClear}>
        <p>oculto</p>
      </FilterPill>,
    )
    const clearBtn = screen.getByRole('button', { name: /Limpiar filtro de estado/i })
    clearBtn.focus()
    await userEvent.keyboard('{Enter}')
    expect(onClear).toHaveBeenCalled()
  })
})

describe('<FilterPopoverHeader />', () => {
  it('renders title + action slot', () => {
    renderWithProviders(<FilterPopoverHeader title="Filtrar" action={<button>limpiar</button>} />)
    expect(screen.getByText(/filtrar/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument()
  })
})

describe('<FilterPopoverFooter />', () => {
  it('renders apply + clear when showClear=true', async () => {
    const user = userEvent.setup()
    const apply = vi.fn()
    const clear = vi.fn()
    renderWithProviders(<FilterPopoverFooter onApply={apply} onClear={clear} />)
    await user.click(screen.getByRole('button', { name: /aplicar/i }))
    await user.click(screen.getByRole('button', { name: /limpiar/i }))
    expect(apply).toHaveBeenCalled()
    expect(clear).toHaveBeenCalled()
  })

  it('hides the clear button when showClear=false', () => {
    renderWithProviders(<FilterPopoverFooter onApply={() => {}} showClear={false} />)
    expect(screen.queryByRole('button', { name: /limpiar/i })).not.toBeInTheDocument()
  })
})
