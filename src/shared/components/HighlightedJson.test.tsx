import { describe, it, expect } from 'vitest'
import { renderWithProviders, screen } from '@/test/render'
import { HighlightedJson } from './HighlightedJson'

describe('<HighlightedJson />', () => {
  it('renders a <pre> with the pretty-printed JSON', () => {
    const { container } = renderWithProviders(<HighlightedJson value={{ foo: 'bar' }} />)
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    // foo should be rendered as a token; bar should appear as the value string
    expect(pre?.textContent).toContain('foo')
    expect(pre?.textContent).toContain('bar')
  })

  it('highlights number / boolean / null literals', () => {
    renderWithProviders(<HighlightedJson value={{ a: 1, b: true, c: null }} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('true')).toBeInTheDocument()
    expect(screen.getByText('null')).toBeInTheDocument()
  })

  it('handles arrays and nested structures', () => {
    const { container } = renderWithProviders(
      <HighlightedJson value={{ items: [1, 2, 3], meta: { ok: true } }} />,
    )
    const pre = container.querySelector('pre')
    expect(pre?.textContent).toMatch(/items/)
    expect(pre?.textContent).toMatch(/meta/)
    expect(pre?.textContent).toMatch(/ok/)
  })

  it('falls back to String() when value is not JSON-serializable', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const { container } = renderWithProviders(<HighlightedJson value={cyclic} />)
    expect(container.querySelector('pre')).not.toBeNull()
  })

  it('accepts a className prop', () => {
    const { container } = renderWithProviders(
      <HighlightedJson value={{ a: 1 }} className="custom-class" />,
    )
    expect(container.querySelector('pre')?.className).toMatch(/custom-class/)
  })
})
