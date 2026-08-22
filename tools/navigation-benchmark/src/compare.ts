import type { NavigationMetrics } from './types'

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
