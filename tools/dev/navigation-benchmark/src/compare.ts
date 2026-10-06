import { readFile } from 'node:fs/promises'

import * as v from 'valibot'

import type { NavigationMetrics } from './types'

const distributionSchema = v.object({
  count: v.number(),
  min: v.number(),
  median: v.number(),
  p95: v.number(),
  p99: v.number(),
  max: v.number(),
  mean: v.number()
})

const thresholdsSchema = v.object({
  over8Ms: v.number(),
  over16Ms: v.number(),
  over33Ms: v.number(),
  over50Ms: v.number()
})

const metricsSchema: v.GenericSchema<unknown, NavigationMetrics> = v.object({
  durationMs: v.number(),
  eventCount: v.number(),
  viewportUpdateCount: v.number(),
  renderCount: v.number(),
  displayFrameIntervalsMs: distributionSchema,
  renderFrameIntervalsMs: distributionSchema,
  renderDurationsMs: distributionSchema,
  eventToViewportMs: distributionSchema,
  eventToRenderEndMs: distributionSchema,
  zoomAnchorDriftPx: distributionSchema,
  maximumJumpPx: v.number(),
  finalInputToCrispMs: v.nullable(v.number()),
  scheduler: v.object({
    frameCount: v.number(),
    maximumJobsPerFrame: v.number(),
    maximumJobRenderMs: v.number(),
    overBudgetJobs: v.number(),
    maximumDeadlineOverrunMs: v.number(),
    cancelledJobs: v.number()
  }),
  longTasks: v.object({ count: v.number(), totalMs: v.number(), maximumMs: v.number() }),
  missedDisplayFrames: thresholdsSchema,
  renderGaps: thresholdsSchema
})

/** Read metrics a previous `run` wrote. */
export async function readMetrics(path: string): Promise<NavigationMetrics> {
  return v.parse(v.pipe(v.string(), v.parseJson(), metricsSchema), await readFile(path, 'utf8'))
}

export interface MetricComparison {
  baseline: number | null
  candidate: number | null
  delta: number | null
  ratio: number | null
}

export interface NavigationComparison {
  displayFrameP95Ms: MetricComparison
  displayFrameP99Ms: MetricComparison
  renderP95Ms: MetricComparison
  inputToRenderP95Ms: MetricComparison
  zoomAnchorDriftMaxPx: MetricComparison
  maximumJumpPx: MetricComparison
  finalInputToCrispMs: MetricComparison
  longTaskTotalMs: MetricComparison
}

function compare(baseline: number | null, candidate: number | null): MetricComparison {
  return {
    baseline,
    candidate,
    delta: baseline === null || candidate === null ? null : candidate - baseline,
    ratio: baseline === null || candidate === null || baseline === 0 ? null : candidate / baseline
  }
}

export function compareNavigationMetrics(
  baseline: NavigationMetrics,
  candidate: NavigationMetrics
): NavigationComparison {
  return {
    displayFrameP95Ms: compare(
      baseline.displayFrameIntervalsMs.p95,
      candidate.displayFrameIntervalsMs.p95
    ),
    displayFrameP99Ms: compare(
      baseline.displayFrameIntervalsMs.p99,
      candidate.displayFrameIntervalsMs.p99
    ),
    renderP95Ms: compare(baseline.renderDurationsMs.p95, candidate.renderDurationsMs.p95),
    inputToRenderP95Ms: compare(baseline.eventToRenderEndMs.p95, candidate.eventToRenderEndMs.p95),
    zoomAnchorDriftMaxPx: compare(baseline.zoomAnchorDriftPx.max, candidate.zoomAnchorDriftPx.max),
    maximumJumpPx: compare(baseline.maximumJumpPx, candidate.maximumJumpPx),
    finalInputToCrispMs: compare(baseline.finalInputToCrispMs, candidate.finalInputToCrispMs),
    longTaskTotalMs: compare(baseline.longTasks.totalMs, candidate.longTasks.totalMs)
  }
}
