import { describe, it, expect, beforeAll, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { CommandPalette, CommandPaletteProvider } from './CommandPalette'
import { useCommandPalette } from './use-command-palette'

// cmdk uses ResizeObserver and scrollIntoView — not available in jsdom.
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

function OpenButton() {
  const { open } = useCommandPalette()
  return (
    <button type="button" onClick={open}>
      open-palette
    </button>
  )
}

function ToggleTest() {
  return (
    <CommandPaletteProvider>
      <OpenButton />
      <CommandPalette />
    </CommandPaletteProvider>
  )
}

describe('<CommandPalette />', () => {
  it('is hidden by default', () => {
    renderWithProviders(<ToggleTest />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens when the provider helper hook is invoked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ToggleTest />)
    await user.click(screen.getByRole('button', { name: /open-palette/i }))
    expect(await screen.findByRole('dialog', { name: /paleta de comandos/i })).toBeInTheDocument()
  })

  it('opens with the ⌘K shortcut and closes with Escape', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ToggleTest />)

    await user.keyboard('{Meta>}k{/Meta}')
    expect(await screen.findByRole('dialog', { name: /paleta de comandos/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /paleta de comandos/i })).not.toBeInTheDocument(),
    )
  })

  it('shows the Navegación group with the dashboard entry', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ToggleTest />)
    await user.click(screen.getByRole('button', { name: /open-palette/i }))
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /paleta de comandos/i })).toBeInTheDocument(),
    )
    expect(screen.getByText(/ir a resumen/i)).toBeInTheDocument()
    expect(screen.getByText(/ir a activity log/i)).toBeInTheDocument()
  })

  it('filters items when the user types in the search', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ToggleTest />)
    await user.click(screen.getByRole('button', { name: /open-palette/i }))

    const input = await screen.findByPlaceholderText(/buscar venues/i)
    await user.type(input, 'activity')

    // The "Ir a activity log" item remains; the unrelated logout label is filtered out.
    expect(screen.getByText(/ir a activity log/i)).toBeInTheDocument()
    expect(screen.queryByText(/cerrar sesión/i)).not.toBeInTheDocument()
  })
})
