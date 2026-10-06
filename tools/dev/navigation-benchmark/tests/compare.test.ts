import { describe, expect, test } from 'bun:test'

import { compareNavigationMetrics } from '../src/compare'
import type { NavigationMetrics } from '../src/types'

function metrics(displayP95: number, crispMs: number): NavigationMetrics {
  const distribution = { count: 1, min: 1, median: 1, p95: displayP95, p99: 1, max: 1, mean: 1 }
  return {
    durationMs: 1,
    eventCount: 1,
    viewportUpdateCount: 1,
    renderCount: 1,
    displayFrameIntervalsMs: distribution,
    renderFrameIntervalsMs: distribution,
    renderDurationsMs: distribution,
    eventToViewportMs: distribution,
    eventToRenderEndMs: distribution,
    zoomAnchorDriftPx: distribution,
    maximumJumpPx: 1,
    finalInputToCrispMs: crispMs,
    scheduler: {
      frameCount: 0,
      maximumJobsPerFrame: 0,
      maximumJobRenderMs: 0,
      overBudgetJobs: 0,
      maximumDeadlineOverrunMs: 0,
      cancelledJobs: 0
    },
    longTasks: { count: 0, totalMs: 0, maximumMs: 0 },
    missedDisplayFrames: { over8Ms: 0, over16Ms: 0, over33Ms: 0, over50Ms: 0 },
    renderGaps: { over8Ms: 0, over16Ms: 0, over33Ms: 0, over50Ms: 0 }
  }
}

describe('navigation benchmark comparison', () => {
  test('reports absolute and relative candidate regressions', () => {
    const comparison = compareNavigationMetrics(metrics(10, 40), metrics(15, 60))
    expect(comparison.displayFrameP95Ms).toEqual({
      baseline: 10,
      candidate: 15,
      delta: 5,
      ratio: 1.5
    })
    expect(comparison.finalInputToCrispMs.ratio).toBe(1.5)
  })
})
