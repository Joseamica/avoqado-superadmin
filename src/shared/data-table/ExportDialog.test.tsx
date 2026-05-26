import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { ExportDialog } from './ExportDialog'

// Radix Dialog uses ResizeObserver — not available in jsdom.
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

interface Row {
  id: string
  name: string
  email: string
  createdAt: string
}

const SAMPLE: Row[] = [
  { id: '1', name: 'Ada', email: 'ada@x.io', createdAt: '2026-01-01T00:00:00Z' },
  { id: '2', name: 'Bob', email: 'bob@x.io', createdAt: '2026-01-02T00:00:00Z' },
  { id: '3', name: 'Cid', email: 'cid@x.io', createdAt: '2026-02-01T00:00:00Z' },
]

const COLUMNS = [
  { key: 'id', header: 'ID', accessor: (r: Row) => r.id },
  { key: 'name', header: 'Nombre', accessor: (r: Row) => r.name },
  { key: 'email', header: 'Email', accessor: (r: Row) => r.email },
]

const createSpy = vi.fn<() => string>()
const revokeSpy = vi.fn<(s: string) => void>()

beforeEach(() => {
  // jsdom doesn't implement URL.createObjectURL — stub it for the download path
  createSpy.mockReset()
  revokeSpy.mockReset()
  createSpy.mockReturnValue('blob:fake')
  vi.stubGlobal('URL', { ...URL, createObjectURL: createSpy, revokeObjectURL: revokeSpy })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('<ExportDialog />', () => {
  it('renders the trigger button by default', () => {
    renderWithProviders(<ExportDialog data={SAMPLE} columns={COLUMNS} filename="rows" />)
    expect(screen.getByRole('button', { name: /^exportar$/i })).toBeInTheDocument()
  })

  it('opens the dialog when the trigger is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExportDialog data={SAMPLE} columns={COLUMNS} filename="rows" />)
    await user.click(screen.getByRole('button', { name: /^exportar$/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^exportar$/i })).toBeInTheDocument()
  })

  it('shows row + column count summary', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExportDialog data={SAMPLE} columns={COLUMNS} filename="rows" />)
    await user.click(screen.getByRole('button', { name: /^exportar$/i }))
    await waitFor(() => expect(screen.getByText(/3 filas serán exportadas/i)).toBeInTheDocument())
  })

  it('toggles a column off via its checkbox', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExportDialog data={SAMPLE} columns={COLUMNS} filename="rows" />)
    await user.click(screen.getByRole('button', { name: /^exportar$/i }))

    const cb = await screen.findByRole('checkbox', { name: /email/i })
    await user.click(cb)
    expect(screen.getByText(/2\/3/i)).toBeInTheDocument()
  })

  it('uses "Ninguna" to clear all and disables Descargar when no columns selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExportDialog data={SAMPLE} columns={COLUMNS} filename="rows" />)
    await user.click(screen.getByRole('button', { name: /^exportar$/i }))

    await user.click(await screen.findByRole('button', { name: /^ninguna$/i }))
    expect(screen.getByRole('button', { name: /descargar/i })).toBeDisabled()
  })

  it('downloads the CSV when "Descargar" is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExportDialog data={SAMPLE} columns={COLUMNS} filename="rows" />)
    await user.click(screen.getByRole('button', { name: /^exportar$/i }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: /descargar/i }))
    expect(createSpy).toHaveBeenCalled()
  })

  it('renders date-range inputs when dateAccessor is provided', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ExportDialog
        data={SAMPLE}
        columns={COLUMNS}
        filename="rows"
        dateAccessor={(r) => r.createdAt}
      />,
    )
    await user.click(screen.getByRole('button', { name: /^exportar$/i }))
    expect(await screen.findByLabelText(/desde/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument()
  })
})
