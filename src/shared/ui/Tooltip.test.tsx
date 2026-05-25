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
import { Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from './Tooltip'

describe('<Tooltip /> (convenience)', () => {
  it('renders the trigger child', () => {
    renderWithProviders(
      <TooltipProvider>
        <Tooltip content="Hola">
          <button>tip-trigger</button>
        </Tooltip>
      </TooltipProvider>,
    )
    expect(screen.getByRole('button', { name: /tip-trigger/i })).toBeInTheDocument()
  })
})

describe('Low-level tooltip parts', () => {
  it('exposes TooltipRoot, TooltipTrigger, TooltipContent without crashing', () => {
    renderWithProviders(
      <TooltipProvider>
        <TooltipRoot>
          <TooltipTrigger asChild>
            <button>raw-trigger</button>
          </TooltipTrigger>
          <TooltipContent>contenido</TooltipContent>
        </TooltipRoot>
      </TooltipProvider>,
    )
    expect(screen.getByRole('button', { name: /raw-trigger/i })).toBeInTheDocument()
  })
})
