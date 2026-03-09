import { describe, it, expect } from 'bun:test'
import { FrameStats, DrawCallCounter, PhaseTimer, GPUTimer, CaptureStack, toSpeedscopeJSON } from '@open-pencil/core'

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

describe('DrawCallCounter', () => {
  it('handles null GL context', () => {
    const counter = new DrawCallCounter(null)
    expect(counter.count).toBe(0)
    expect(counter.reset()).toBe(0)
    counter.destroy()
  })
})

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

describe('CaptureStack', () => {
  it('builds a tree of node profiles', () => {
    const stack = new CaptureStack()
    stack.reset(performance.now())

    stack.begin('node-1', 'Frame 1', 'FRAME', false)
    stack.begin('node-2', 'Rect', 'RECTANGLE', false)
    stack.end(2)
    stack.end(3)

    const roots = stack.getRootProfiles()
    expect(roots).toHaveLength(1)
    expect(roots[0].nodeId).toBe('node-1')
    expect(roots[0].children).toHaveLength(1)
    expect(roots[0].children[0].nodeId).toBe('node-2')
    expect(roots[0].children[0].drawCalls).toBe(2)
  })
})

describe('toSpeedscopeJSON', () => {
  it('produces valid speedscope JSON', () => {
    const capture = {
      timestamp: 0,
      totalTimeMs: 10,
      cpuTimeMs: 8,
      gpuTimeMs: 6,
      totalNodes: 5,
      culledNodes: 1,
      drawCalls: 10,
      scenePictureCacheHit: false,
      rootProfiles: [
        {
          nodeId: 'n1',
          name: 'Frame',
          type: 'FRAME',
          depth: 0,
          startTime: 0,
          endTime: 10,
          selfTime: 5,
          drawCalls: 3,
          culled: false,
          children: [
            {
              nodeId: 'n2',
              name: 'Rect',
              type: 'RECTANGLE',
              depth: 1,
              startTime: 2,
              endTime: 7,
              selfTime: 5,
              drawCalls: 2,
              culled: false,
              children: []
            }
          ]
        }
      ]
    }

    const json = toSpeedscopeJSON(capture)
    const parsed = JSON.parse(json)

    expect(parsed.$schema).toBe('https://www.speedscope.app/file-format-schema.json')
    expect(parsed.profiles).toHaveLength(1)
    expect(parsed.profiles[0].type).toBe('evented')
    expect(parsed.profiles[0].unit).toBe('milliseconds')
    expect(parsed.shared.frames).toHaveLength(2)
    expect(parsed.profiles[0].events).toHaveLength(4)
  })
})
