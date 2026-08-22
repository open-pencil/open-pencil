import type { NavigationTraceEvent, RecordedWheelSample } from '@open-pencil/core/profiler'
import { subscribeNavigationTrace } from '@open-pencil/core/profiler'

export interface NavigationRecording {
  schemaVersion: 1
  name: string
  source: 'macos-trackpad' | 'synthetic'
  recordedAt: string
  environment: {
    userAgent: string
    platform: string
    devicePixelRatio: number
    viewportWidth: number
    viewportHeight: number
    canvasWidth: number
    canvasHeight: number
  }
  sceneRenderer: 'existing' | 'tiled'
  initialViewport: { panX: number; panY: number; zoom: number }
  wheel: RecordedWheelSample[]
  trace: NavigationTraceEvent[]
}

type Viewport = NavigationRecording['initialViewport']

export interface NavigationRecorder {
  stop: () => NavigationRecording
}

export function startNavigationRecorder(
  canvas: HTMLCanvasElement,
  name: string,
  initialViewport: Viewport,
  sceneRenderer: NavigationRecording['sceneRenderer']
): NavigationRecorder {
  const startedAt = performance.now()
  const wheel: RecordedWheelSample[] = []
  const trace: NavigationTraceEvent[] = []
  let frameId: number | null = null
  const recordAnimationFrame = (timestamp: number) => {
    trace.push({ name: 'animation:frame', timestamp: timestamp - startedAt, detail: {} })
    frameId = requestAnimationFrame(recordAnimationFrame)
  }
  frameId = requestAnimationFrame(recordAnimationFrame)

  const longTaskObserver =
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes.includes('longtask')
      ? new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            trace.push({
              name: 'main:long-task',
              timestamp: entry.startTime - startedAt,
              detail: { durationMs: entry.duration }
            })
          }
        })
      : null
  longTaskObserver?.observe({ entryTypes: ['longtask'] })

  const recordWheel = (event: WheelEvent) => {
    const extended = event as WheelEvent & { webkitDirectionInvertedFromDevice?: boolean }
    wheel.push({
      timeMs: performance.now() - startedAt,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      clientX: event.clientX,
      clientY: event.clientY,
      cancelable: event.cancelable,
      directionInvertedFromDevice: extended.webkitDirectionInvertedFromDevice
    })
  }
  canvas.addEventListener('wheel', recordWheel, { capture: true, passive: true })
  const unsubscribeTrace = subscribeNavigationTrace((event) => {
    trace.push({ ...event, timestamp: event.timestamp - startedAt })
  })

  return {
    stop() {
      canvas.removeEventListener('wheel', recordWheel, { capture: true })
      if (frameId !== null) cancelAnimationFrame(frameId)
      longTaskObserver?.disconnect()
      unsubscribeTrace()
      const rect = canvas.getBoundingClientRect()
      return {
        schemaVersion: 1,
        name,
        source: 'macos-trackpad',
        recordedAt: new Date().toISOString(),
        environment: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          devicePixelRatio: window.devicePixelRatio,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          canvasWidth: rect.width,
          canvasHeight: rect.height
        },
        sceneRenderer,
        initialViewport,
        wheel,
        trace
      }
    }
  }
}
