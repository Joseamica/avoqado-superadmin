import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EarningsTrend } from './EarningsTrend'

// jsdom doesn't implement ResizeObserver; stub it so recharts doesn't throw.
beforeAll(() => {
  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

const data = [
  { date: '2026-05-01', terminalProfit: 100, onlineFees: 10, profit: 110 },
  { date: '2026-05-02', terminalProfit: 200, onlineFees: 0, profit: 200 },
]

describe('EarningsTrend', () => {
  it('renders the granularity toggle and calls back on change', () => {
    const onGranularityChange = vi.fn()
    render(
      <EarningsTrend data={data} granularity="daily" onGranularityChange={onGranularityChange} />,
    )
    expect(screen.getByRole('button', { name: 'Día' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
    expect(onGranularityChange).toHaveBeenCalledWith('weekly')
  })
})
