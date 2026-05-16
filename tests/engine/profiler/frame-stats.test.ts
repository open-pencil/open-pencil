import { describe, it, expect } from 'bun:test'

import { FrameStats } from '@open-pencil/core'

describe('FrameStats', () => {
  it('records frames and computes rolling averages', () => {
    const stats = new FrameStats()

    for (let i = 0; i < 10; i++) {
      stats.recordFrame(5)
    }

    expect(stats.avgCpuTime).toBe(5)
    expect(stats.smoothedFps).toBeGreaterThan(0)
    expect(stats.getFrameTimeHistory()).toBeInstanceOf(Float64Array)
    expect(stats.getBufferCount()).toBe(10)
  })

  it('tracks external fields', () => {
    const stats = new FrameStats()
    stats.totalNodes = 100
    stats.culledNodes = 20
    stats.drawCalls = 50
    stats.scenePictureCacheHit = true

    expect(stats.totalNodes).toBe(100)
    expect(stats.culledNodes).toBe(20)
    expect(stats.drawCalls).toBe(50)
    expect(stats.scenePictureCacheHit).toBe(true)
  })

  it('handles GPU time as NaN initially', () => {
    const stats = new FrameStats()
    stats.recordFrame(1)
    expect(stats.gpuTime).toBe(0)
  })
})

