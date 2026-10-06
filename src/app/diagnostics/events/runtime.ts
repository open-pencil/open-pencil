import { diagnosticErrorDetails } from '../error'
import { recordDiagnostic } from '../recorder'

/** Where an uncaught failure surfaced: the window, an unhandled rejection, or a Vue component. */
export type RuntimeErrorSource = 'window' | 'rejection' | 'vue'

/**
 * A render loop can throw every frame, sometimes alternating between errors; one record per
 * distinct error per window is enough. Keys are kept in insertion order, oldest first.
 */
const REPEAT_WINDOW_MS = 2000
const MAX_TRACKED_ERRORS = 50
const recentErrors = new Map<string, number>()

/** Whether `key` was recorded within the window; remembers it as recorded now if not. */
function isRepeat(key: string, now: number): boolean {
  for (const [recentKey, at] of recentErrors) {
    if (now - at < REPEAT_WINDOW_MS) break
    recentErrors.delete(recentKey)
  }
  if (recentErrors.has(key)) return true
  recentErrors.set(key, now)
  if (recentErrors.size > MAX_TRACKED_ERRORS) {
    const [oldest] = recentErrors.keys()
    recentErrors.delete(oldest)
  }
  return false
}

/**
 * Record an uncaught error with its scrubbed message and stack. `info` is Vue's hint about
 * where a component error happened, such as `render function` or `watcher callback`.
 */
export function recordRuntimeError(
  error: unknown,
  source: RuntimeErrorSource,
  info?: string
): void {
  const details = diagnosticErrorDetails(error)
  const key = `${source}\n${details.errorName}\n${details.message ?? ''}\n${details.stack ?? ''}`
  if (isRepeat(key, Date.now())) return
  recordDiagnostic({
    category: 'runtime',
    level: 'error',
    name: 'runtime.error',
    attributes: {
      source,
      errorName: details.errorName,
      errorCode: details.errorCode,
      message: details.message,
      stack: details.stack,
      info: info ?? null
    }
  })
}
