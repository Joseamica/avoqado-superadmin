import { describe, it, expect } from 'vitest'
import { renderWithProviders, screen } from '@/test/render'
import { Kbd } from './Kbd'

describe('<Kbd />', () => {
  it('renders its children inside a <kbd> tag', () => {
    renderWithProviders(<Kbd>⌘</Kbd>)
    const el = screen.getByText('⌘')
    expect(el.tagName).toBe('KBD')
  })

  it('merges className with the base styles', () => {
    renderWithProviders(<Kbd className="extra">K</Kbd>)
    const el = screen.getByText('K')
    expect(el.className).toMatch(/extra/)
  })

  it('forwards other HTML attributes', () => {
    renderWithProviders(<Kbd data-testid="kbd">esc</Kbd>)
    expect(screen.getByTestId('kbd')).toBeInTheDocument()
  })
})
