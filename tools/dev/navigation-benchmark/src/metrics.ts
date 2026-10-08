import type { Distribution, NavigationMetrics, NavigationRecordingFile, TraceEvent } from './types'

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  return sorted[index] ?? 0
}

export function distribution(values: readonly number[]): Distribution {
  if (values.length === 0) {
    return { count: 0, min: 0, median: 0, p95: 0, p99: 0, max: 0, mean: 0 }
  }
  const sorted = [...values].sort((a, b) => a - b)
  return {
    count: sorted.length,
    min: round(sorted[0] ?? 0),
    median: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    max: round(sorted.at(-1) ?? 0),
    mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length)
  }
}

function events(trace: readonly TraceEvent[], name: string): TraceEvent[] {
  return trace.filter((event) => event.name === name)
}

function nextTimestamp(trace: readonly TraceEvent[], after: number, name: string): number | null {
  return trace.find((event) => event.timestamp >= after && event.name === name)?.timestamp ?? null
}

function numeric(event: TraceEvent, key: string): number | null {
  const value = event.detail[key]
  return typeof value === 'number' ? value : null
}

function renderPairs(trace: readonly TraceEvent[]): Array<{ start: TraceEvent; end: TraceEvent }> {
  const pending: TraceEvent[] = []
  const pairs: Array<{ start: TraceEvent; end: TraceEvent }> = []
  for (const event of trace) {
    if (event.name === 'render:start') pending.push(event)
    if (event.name === 'render:end' && event.detail.layer !== 'tiled-scheduler') {
      const start = pending.shift()
      if (start) pairs.push({ start, end: event })
    }
  }
  return pairs
}

function zoomAnchorDrift(
  trace: readonly TraceEvent[],
  recording: NavigationRecordingFile
): number[] {
  const zoomEvents = recording.wheel.filter((event) => event.ctrlKey || event.metaKey)
  const center = zoomEvents.at(-1)
  if (!center) return []
  const viewports = events(trace, 'viewport:changed').filter((event) => {
    const zoom = numeric(event, 'zoom')
    const previousZoom = numeric(event, 'previousZoom')
    return zoom !== null && previousZoom !== null && zoom !== previousZoom
  })
  return viewports.map((event) => {
    const panX = numeric(event, 'panX') ?? 0
    const panY = numeric(event, 'panY') ?? 0
    const zoom = numeric(event, 'zoom') ?? 1
    const previousPanX = numeric(event, 'previousPanX') ?? 0
    const previousPanY = numeric(event, 'previousPanY') ?? 0
    const previousZoom = numeric(event, 'previousZoom') ?? 1
    const worldX = (center.clientX - previousPanX) / previousZoom
    const worldY = (center.clientY - previousPanY) / previousZoom
    const projectedX = worldX * zoom + panX
    const projectedY = worldY * zoom + panY
    return Math.hypot(projectedX - center.clientX, projectedY - center.clientY)
  })
}

function navigationRenderEvents(trace: readonly TraceEvent[]): TraceEvent[] {
  return events(trace, 'render:end').filter((event) => event.detail.layer !== 'tiled-scheduler')
}

function maximumViewportJump(trace: readonly TraceEvent[]): number {
  return navigationRenderEvents(trace).reduce((maximum, event, index, rendered) => {
    const previous = rendered[index - 1]
    if (!previous) return maximum
    const panX = numeric(event, 'panX') ?? 0
    const panY = numeric(event, 'panY') ?? 0
    const previousPanX = numeric(previous, 'panX') ?? 0
    const previousPanY = numeric(previous, 'panY') ?? 0
    return Math.max(maximum, Math.hypot(panX - previousPanX, panY - previousPanY))
  }, 0)
}

function intervalCounts(intervals: readonly number[]) {
  return {
    over8Ms: intervals.filter((duration) => duration > 1000 / 120).length,
    over16Ms: intervals.filter((duration) => duration > 1000 / 60).length,
    over33Ms: intervals.filter((duration) => duration > 1000 / 30).length,
    over50Ms: intervals.filter((duration) => duration > 50).length
  }
}

export function computeNavigationMetrics(recording: NavigationRecordingFile): NavigationMetrics {
  const trace = [...recording.trace].sort((a, b) => a.timestamp - b.timestamp)
  const rendered = navigationRenderEvents(trace)
  const received = events(trace, 'wheel:received')
  const finalInput = received.at(-1)?.timestamp ?? recording.wheel.at(-1)?.timeMs ?? 0
  const interactionFrames = rendered.filter((event) => event.timestamp <= finalInput + 50)
  const renderFrameIntervals = interactionFrames.slice(1).map((event, index) => {
    const previous = interactionFrames[index]
    return previous ? event.timestamp - previous.timestamp : 0
  })
  const animationFrames = events(trace, 'animation:frame').filter(
    (event) => event.timestamp <= finalInput + 50
  )
  const displayFrameIntervals = animationFrames.slice(1).map((event, index) => {
    const previous = animationFrames[index]
    return previous ? event.timestamp - previous.timestamp : 0
  })
  const pairs = renderPairs(trace)
  const renderDurations = pairs.map(({ start, end }) => end.timestamp - start.timestamp)
  const eventToViewport = received.flatMap((event) => {
    const next = nextTimestamp(trace, event.timestamp, 'viewport:changed')
    return next === null ? [] : [next - event.timestamp]
  })
  const eventToRenderEnd = received.flatMap((event) => {
    const next = nextTimestamp(rendered, event.timestamp, 'render:end')
    return next === null ? [] : [next - event.timestamp]
  })
  const crispCandidates = (
    recording.sceneRenderer === 'tiled'
      ? events(trace, 'tiles:coverage-complete')
      : [
          ...events(trace, 'backing:crisp'),
          ...rendered.filter((event) => event.detail.backingCrisp === true)
        ]
  ).sort((a, b) => a.timestamp - b.timestamp)
  const crisp = crispCandidates.find((event) => event.timestamp >= finalInput)
  const schedulerEvents = events(trace, 'render:end').filter(
    (event) => event.detail.layer === 'tiled-scheduler'
  )
  const schedulerNumbers = (key: string) =>
    schedulerEvents.flatMap((event) => {
      const value = numeric(event, key)
      return value === null ? [] : [value]
    })
  const schedulerCompleted = schedulerEvents.map(
    (event) =>
      (numeric(event, 'mandatoryCompleted') ?? 0) + (numeric(event, 'interruptibleCompleted') ?? 0)
  )
  const longTaskDurations = events(trace, 'main:long-task').flatMap((event) => {
    const duration = numeric(event, 'durationMs')
    return duration === null ? [] : [duration]
  })

  return {
    durationMs: round((trace.at(-1)?.timestamp ?? 0) - (trace[0]?.timestamp ?? 0)),
    eventCount: received.length || recording.wheel.length,
    viewportUpdateCount: events(trace, 'viewport:changed').length,
    renderCount: rendered.length,
    displayFrameIntervalsMs: distribution(displayFrameIntervals),
    renderFrameIntervalsMs: distribution(renderFrameIntervals),
    renderDurationsMs: distribution(renderDurations),
    eventToViewportMs: distribution(eventToViewport),
    eventToRenderEndMs: distribution(eventToRenderEnd),
    zoomAnchorDriftPx: distribution(zoomAnchorDrift(trace, recording)),
    maximumJumpPx: round(maximumViewportJump(trace)),
    finalInputToCrispMs: crisp ? round(crisp.timestamp - finalInput) : null,
    scheduler: {
      frameCount: schedulerEvents.length,
      maximumJobsPerFrame: Math.max(0, ...schedulerCompleted),
      maximumJobRenderMs: round(Math.max(0, ...schedulerNumbers('maximumJobRenderMs'))),
      overBudgetJobs: schedulerNumbers('overBudgetJobs').reduce((sum, value) => sum + value, 0),
      maximumDeadlineOverrunMs: round(Math.max(0, ...schedulerNumbers('deadlineOverrunMs'))),
      cancelledJobs: schedulerNumbers('cancelledJobs').reduce((sum, value) => sum + value, 0)
    },
    longTasks: {
      count: longTaskDurations.length,
      totalMs: round(longTaskDurations.reduce((sum, duration) => sum + duration, 0)),
      maximumMs: round(Math.max(0, ...longTaskDurations))
    },
    missedDisplayFrames: intervalCounts(displayFrameIntervals),
    renderGaps: intervalCounts(renderFrameIntervals)
  }
}
