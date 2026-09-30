import { describe, expect, test } from 'bun:test'

import { computeNavigationMetrics, distribution } from '../src/metrics'
import type { NavigationRecordingFile } from '../src/types'

describe('navigation benchmark metrics', () => {
  test('computes nearest-rank distributions', () => {
    expect(distribution([1, 2, 3, 4, 100])).toEqual({
      count: 5,
      min: 1,
      median: 3,
      p95: 100,
      p99: 100,
      max: 100,
      mean: 22
    })
  })

  test('uses tiled coverage rather than fallback backing for tiled settlement', () => {
    const recording: NavigationRecordingFile = {
      schemaVersion: 1,
      name: 'tiled',
      source: 'synthetic',
      recordedAt: '',
      environment: {},
      sceneRenderer: 'tiled',
      initialViewport: { panX: 0, panY: 0, zoom: 1 },
      wheel: [],
      trace: [
        { name: 'wheel:received', timestamp: 10, detail: {} },
        { name: 'backing:crisp', timestamp: 20, detail: {} },
        { name: 'tiles:coverage-complete', timestamp: 140, detail: {} }
      ]
    }

    expect(computeNavigationMetrics(recording).finalInputToCrispMs).toBe(130)
  })

  test('correlates input, viewport, render, and crisp backing events', () => {
    const recording: NavigationRecordingFile = {
      schemaVersion: 1,
      name: 'test',
      source: 'synthetic',
      recordedAt: '',
      environment: {},
      sceneRenderer: 'retained',
      initialViewport: { panX: 0, panY: 0, zoom: 1 },
      wheel: [
        {
          timeMs: 0,
          deltaX: 0,
          deltaY: -1,
          deltaMode: 0,
          ctrlKey: true,
          metaKey: false,
          shiftKey: false,
          clientX: 100,
          clientY: 100,
          cancelable: true
        }
      ],
      trace: [
        { name: 'animation:frame', timestamp: 0, detail: {} },
        { name: 'wheel:received', timestamp: 0, detail: {} },
        {
          name: 'viewport:changed',
          timestamp: 4,
          detail: {
            panX: -10,
            panY: -10,
            zoom: 1.1,
            previousPanX: 0,
            previousPanY: 0,
            previousZoom: 1
          }
        },
        { name: 'render:start', timestamp: 6, detail: {} },
        {
          name: 'render:end',
          timestamp: 10,
          detail: { layer: 'scene', panX: -10, panY: -10, zoom: 1.1 }
        },
        { name: 'animation:frame', timestamp: 16, detail: {} },
        { name: 'render:start', timestamp: 20, detail: {} },
        {
          name: 'render:end',
          timestamp: 30,
          detail: { layer: 'scene', panX: -12, panY: -10, zoom: 1.1 }
        },
        { name: 'animation:frame', timestamp: 32, detail: {} },
        { name: 'main:long-task', timestamp: 33, detail: { durationMs: 60 } },
        {
          name: 'render:end',
          timestamp: 35,
          detail: {
            layer: 'tiled-scheduler',
            mandatoryCompleted: 0,
            interruptibleCompleted: 4,
            maximumJobRenderMs: 1.5,
            overBudgetJobs: 0,
            deadlineOverrunMs: 0,
            cancelledJobs: 3
          }
        },
        { name: 'backing:crisp', timestamp: 40, detail: {} }
      ]
    }

    const metrics = computeNavigationMetrics(recording)
    expect(metrics.eventToViewportMs.median).toBe(4)
    expect(metrics.eventToRenderEndMs.median).toBe(10)
    expect(metrics.renderDurationsMs.mean).toBe(7)
    expect(metrics.renderFrameIntervalsMs.median).toBe(20)
    expect(metrics.displayFrameIntervalsMs.median).toBe(16)
    expect(metrics.longTasks).toEqual({ count: 1, totalMs: 60, maximumMs: 60 })
    expect(metrics.zoomAnchorDriftPx.max).toBe(0)
    expect(metrics.maximumJumpPx).toBe(2)
    expect(metrics.finalInputToCrispMs).toBe(40)
    expect(metrics.scheduler).toEqual({
      frameCount: 1,
      maximumJobsPerFrame: 4,
      maximumJobRenderMs: 1.5,
      overBudgetJobs: 0,
      maximumDeadlineOverrunMs: 0,
      cancelledJobs: 3
    })
  })
})
