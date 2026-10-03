import type { RecordedWheelSample } from '@open-pencil/core/profiler'

export type WheelSample = RecordedWheelSample

export interface TraceEvent {
  name: string
  timestamp: number
  detail: Record<string, number | string | boolean | null>
}

export interface NavigationRecordingFile {
  schemaVersion: 1
  name: string
  source: 'macos-trackpad' | 'synthetic'
  recordedAt: string
  environment: Record<string, string | number>
  sceneRenderer: 'retained' | 'tiled'
  initialViewport: { panX: number; panY: number; zoom: number }
  wheel: WheelSample[]
  trace: TraceEvent[]
}

export interface NavigationMetrics {
  durationMs: number
  eventCount: number
  viewportUpdateCount: number
  renderCount: number
  displayFrameIntervalsMs: Distribution
  renderFrameIntervalsMs: Distribution
  renderDurationsMs: Distribution
  eventToViewportMs: Distribution
  eventToRenderEndMs: Distribution
  zoomAnchorDriftPx: Distribution
  maximumJumpPx: number
  finalInputToCrispMs: number | null
  scheduler: {
    frameCount: number
    maximumJobsPerFrame: number
    maximumJobRenderMs: number
    overBudgetJobs: number
    maximumDeadlineOverrunMs: number
    cancelledJobs: number
  }
  longTasks: { count: number; totalMs: number; maximumMs: number }
  missedDisplayFrames: { over8Ms: number; over16Ms: number; over33Ms: number; over50Ms: number }
  renderGaps: { over8Ms: number; over16Ms: number; over33Ms: number; over50Ms: number }
}

export interface Distribution {
  count: number
  min: number
  median: number
  p95: number
  p99: number
  max: number
  mean: number
}
