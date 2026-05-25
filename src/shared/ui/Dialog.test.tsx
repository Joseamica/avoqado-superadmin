import { describe, it, expect, beforeAll, vi } from 'vitest'
import { renderWithProviders, screen } from '@/test/render'

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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog'

describe('<Dialog />', () => {
  it('does not render the content when closed', () => {
    renderWithProviders(
      <Dialog>
        <DialogTrigger>Abrir</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Título</DialogTitle>
            <DialogDescription>Descripción</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )
    expect(screen.queryByText('Título')).not.toBeInTheDocument()
  })

  it('renders the content when controlled-open', () => {
    renderWithProviders(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hola</DialogTitle>
            <DialogDescription>Detalle</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>cerrar</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    )
    expect(screen.getByText('Hola')).toBeInTheDocument()
    expect(screen.getByText('Detalle')).toBeInTheDocument()
  })

  it('hides the close icon when showClose=false', () => {
    renderWithProviders(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent showClose={false}>
          <DialogHeader>
            <DialogTitle>SinX</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )
    // Default close has aria-label "Cerrar diálogo"
    expect(screen.queryByRole('button', { name: /cerrar diálogo/i })).not.toBeInTheDocument()
  })
})
