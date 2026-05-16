import { describe, it, expect } from 'bun:test'

import { GPUTimer } from '@open-pencil/core'

describe('GPUTimer', () => {
  it('handles null GL context', () => {
    const timer = new GPUTimer(null)
    expect(timer.available).toBe(false)
    expect(timer.lastGpuTimeMs).toBeNaN()
    timer.beginFrame()
    timer.endFrame()
    expect(timer.pollResults()).toBeNull()
    timer.destroy()
  })
})

