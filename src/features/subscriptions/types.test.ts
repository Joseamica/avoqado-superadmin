import { describe, it, expect } from 'vitest'
import { humanizeState, STATE_TONE, type SubscriptionState } from './types'

const ALL: SubscriptionState[] = [
  'none',
  'trial',
  'active',
  'canceling',
  'past_due',
  'suspended',
  'canceled',
]

describe('humanizeState', () => {
  it('returns a non-empty Spanish label for every state', () => {
    for (const s of ALL) expect(humanizeState(s).length).toBeGreaterThan(0)
  })
  it('maps active and trial to positive tones', () => {
    expect(STATE_TONE.active).toBe('success')
    expect(STATE_TONE.trial).toBe('info')
  })
  it('maps risk states to warn/danger', () => {
    expect(STATE_TONE.past_due).toBe('warn')
    expect(STATE_TONE.suspended).toBe('danger')
  })
})
