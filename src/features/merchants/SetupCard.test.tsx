import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreditCard } from 'lucide-react'
import { SetupCard } from './SetupCard'

describe('SetupCard', () => {
  it('done muestra doneLabel y es clickable', () => {
    const onClick = vi.fn()
    render(
      <SetupCard
        icon={CreditCard}
        title="Venue"
        description="x"
        state="done"
        doneLabel="Doña Simona"
        onClick={onClick}
      />,
    )
    expect(screen.getByText('Doña Simona')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
  it('locked no dispara onClick', () => {
    const onClick = vi.fn()
    render(
      <SetupCard
        icon={CreditCard}
        title="Slot"
        description="x"
        state="locked"
        lockedReason="Selecciona venue"
        onClick={onClick}
      />,
    )
    expect(screen.getByText('Selecciona venue')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
