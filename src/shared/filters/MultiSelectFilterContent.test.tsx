import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test/render'
import { MultiSelectFilterContent, type MultiSelectOption } from './MultiSelectFilterContent'

type Status = 'active' | 'pending' | 'paused'

const OPTIONS: MultiSelectOption<Status>[] = [
  { value: 'active', label: 'Activo' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'paused', label: 'Pausado' },
]

describe('<MultiSelectFilterContent />', () => {
  it('renders the title and option labels', () => {
    renderWithProviders(
      <MultiSelectFilterContent
        title="Estado"
        options={OPTIONS}
        selected={new Set<Status>()}
        onApply={() => {}}
      />,
    )
    expect(screen.getByText(/estado/i)).toBeInTheDocument()
    expect(screen.getByText(/Activo/)).toBeInTheDocument()
    expect(screen.getByText(/Pendiente/)).toBeInTheDocument()
    expect(screen.getByText(/Pausado/)).toBeInTheDocument()
  })

  it('applies the user selection through onApply on click', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    renderWithProviders(
      <MultiSelectFilterContent
        title="Estado"
        options={OPTIONS}
        selected={new Set<Status>()}
        onApply={handler}
      />,
    )

    await user.click(screen.getByText(/^Activo$/))
    await user.click(screen.getByRole('button', { name: /aplicar/i }))

    expect(handler).toHaveBeenCalledTimes(1)
    const set = handler.mock.calls[0][0] as Set<Status>
    expect(set.has('active')).toBe(true)
  })

  it('renders a master toggle that selects all visible', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    renderWithProviders(
      <MultiSelectFilterContent
        title="Estado"
        options={OPTIONS}
        selected={new Set<Status>()}
        onApply={handler}
      />,
    )
    await user.click(screen.getByText(/seleccionar todo/i))
    await user.click(screen.getByRole('button', { name: /aplicar/i }))
    const set = handler.mock.calls[0][0] as Set<Status>
    expect(set.size).toBe(3)
  })

  it('filters options by the searchable input', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <MultiSelectFilterContent
        title="Estado"
        options={OPTIONS}
        selected={new Set<Status>()}
        onApply={() => {}}
        searchable
        searchPlaceholder="Buscar…"
      />,
    )
    const input = screen.getByPlaceholderText(/buscar/i)
    await user.type(input, 'pend')
    expect(screen.queryByText('Activo')).not.toBeInTheDocument()
    expect(screen.getByText(/Pendiente/)).toBeInTheDocument()
  })

  it('shows the empty label when search yields no matches', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <MultiSelectFilterContent
        title="Estado"
        options={OPTIONS}
        selected={new Set<Status>()}
        onApply={() => {}}
        searchable
        emptyLabel="No hay nada"
      />,
    )
    await user.type(screen.getByPlaceholderText(/buscar/i), 'zzz')
    expect(screen.getByText(/no hay nada/i)).toBeInTheDocument()
  })

  it('hides the local "limpiar" footer button when no local selection', () => {
    renderWithProviders(
      <MultiSelectFilterContent
        title="Estado"
        options={OPTIONS}
        selected={new Set<Status>()}
        onApply={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /limpiar/i })).not.toBeInTheDocument()
  })

  it('shows local "limpiar" once the user picks something', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <MultiSelectFilterContent
        title="Estado"
        options={OPTIONS}
        selected={new Set<Status>()}
        onApply={() => {}}
      />,
    )
    await user.click(screen.getByText(/^Activo$/))
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument()
  })
})
