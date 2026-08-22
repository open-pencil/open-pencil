export type NavigationTraceEventName =
  | 'wheel:received'
  | 'wheel:flush'
  | 'viewport:changed'
  | 'render:requested'
  | 'render:start'
  | 'render:end'
  | 'backing:preview'
  | 'backing:build'
  | 'backing:crisp'
  | 'animation:frame'
  | 'main:long-task'
  | 'navigation:phase'
  | 'tiles:coverage-complete'

export interface NavigationTraceEvent {
  name: NavigationTraceEventName
  timestamp: number
  detail: Record<string, number | string | boolean | null>
}

export interface RecordedWheelSample {
  timeMs: number
  deltaX: number
  deltaY: number
  deltaMode: number
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  clientX: number
  clientY: number
  cancelable: boolean
  directionInvertedFromDevice?: boolean
}

export type NavigationTraceListener = (event: NavigationTraceEvent) => void

const listeners = new Set<NavigationTraceListener>()

function timestamp(): number {
  return typeof performance === 'undefined' ? 0 : performance.now()
}

export function emitNavigationTrace(
  name: NavigationTraceEventName,
  detail: NavigationTraceEvent['detail'] = {}
): void {
  if (listeners.size === 0) return
  const event = { name, timestamp: timestamp(), detail }
  if (typeof performance !== 'undefined') {
    performance.mark(`openpencil:${name}`, { detail })
  }
  for (const listener of listeners) listener(event)
}

export function subscribeNavigationTrace(listener: NavigationTraceListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
