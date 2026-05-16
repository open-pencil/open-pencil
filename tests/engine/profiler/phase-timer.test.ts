import { describe, it, expect } from 'bun:test'

import { PhaseTimer } from '@open-pencil/core'

describe('PhaseTimer', () => {
  it('is disabled by default', () => {
    const timer = new PhaseTimer()
    expect(timer.enabled).toBe(false)
  })

  it('records measures when enabled', () => {
    const timer = new PhaseTimer()
    timer.enabled = true
    timer.beginPhase('test')
    timer.endPhase('test')
    timer.clearPhases()
  })

  it('is a no-op when disabled', () => {
    const timer = new PhaseTimer()
    timer.beginPhase('test')
    timer.endPhase('test')
  })
})

