import { randomIndex } from './random'

/** Lengths of time in milliseconds, for durations written in the units they mean. */
export const SECOND_MS = 1_000
export const MINUTE_MS = 60 * SECOND_MS
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

/**
 * How long before a short-lived token expires it is replaced, so a request that starts with it
 * never outlives it.
 */
export const TOKEN_REFRESH_MARGIN_MS = MINUTE_MS

/** The longest delay `setTimeout` keeps: a longer one fires at once. */
export const MAX_TIMER_MS = 2 ** 31 - 1

/**
 * How long each kind of wait may take before it counts as failed, so the same kind of wait has the
 * same bound everywhere. A wait that needs another bound names its own constant and says why.
 */
export const DEADLINE_MS = {
  /** A check of something local, such as a health endpoint, that answers at once or not at all. */
  probe: 2 * SECOND_MS,
  /** An ordinary request to a remote API: a catalog, a token, a small JSON answer. */
  request: 10 * SECOND_MS,
  /** A request the far side works on before it answers: a search, a model's reply, an analysis. */
  slowRequest: 30 * SECOND_MS,
  /** A transfer that moves real data, such as an upload or a large download. */
  transfer: MINUTE_MS
} as const

/**
 * How retries space out: each waits twice the last, from `baseMs` up to `capMs`, and with `jitter`
 * a random part of that, so clients that failed together don't retry together.
 */
export type Backoff = { baseMs: number; capMs: number; jitter: boolean }

/** The retry schedules the codebase uses, by what they retry. */
export const BACKOFF = {
  /** Reconnecting a live connection, such as a collaboration socket: soon, but not in a crowd. */
  reconnect: { baseMs: SECOND_MS, capMs: 30 * SECOND_MS, jitter: true },
  /** Retrying a request or a sync that failed: patient, since the far side may be down a while. */
  retry: { baseMs: SECOND_MS, capMs: MINUTE_MS, jitter: true }
} as const satisfies Record<string, Backoff>

/** How long the retry after `attempt` failed attempts waits, counting from 0. */
export function backoffDelay(attempt: number, backoff: Backoff): number {
  const delay = Math.min(backoff.capMs, backoff.baseMs * 2 ** Math.max(0, attempt))
  if (!backoff.jitter) return delay
  // Equal jitter: at least half the delay, so retries still slow down as they fail.
  const half = Math.floor(delay / 2)
  return half + randomIndex(Math.max(1, delay - half))
}

/** Why `signal` aborted, as an error: its reason, or an `AbortError` when the reason is none. */
export function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted', 'AbortError')
}

/** Whether `error` is a deadline running out, as `AbortSignal.timeout` and `withDeadline` reject. */
export function isDeadline(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError'
}

/**
 * A signal that aborts as soon as any of `signals` does, with that one's reason. `AbortSignal.any`
 * where the runtime has it; the desktop app's WebKit, at Safari 16.4, does not.
 */
export function anySignal(signals: readonly (AbortSignal | null | undefined)[]): AbortSignal {
  const present = signals.filter((signal): signal is AbortSignal => signal instanceof AbortSignal)
  if (present.length === 1 && present[0]) return present[0]
  if (present.length === 0) return new AbortController().signal
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(present)
  const controller = new AbortController()
  const aborted = present.find((signal) => signal.aborted)
  if (aborted) {
    controller.abort(aborted.reason)
    return controller.signal
  }
  const stop = () => {
    for (const signal of present) signal.removeEventListener('abort', onAbort)
  }
  function onAbort(this: AbortSignal) {
    stop()
    controller.abort(this.reason)
  }
  for (const signal of present) signal.addEventListener('abort', onAbort, { once: true })
  return controller.signal
}

/**
 * `promise`, or a rejection with the abort reason as soon as `signal` aborts. The work behind the
 * promise is not stopped; a rejection it settles with later is ignored. For work that takes a
 * signal, `withDeadline` passes one that stops it.
 */
export function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => undefined)
    return Promise.reject(abortReason(signal))
  }
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const onAbort = () => {
      cleanup()
      reject(abortReason(signal))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    void (async () => {
      try {
        const value = await promise
        cleanup()
        resolve(value)
      } catch (error) {
        cleanup()
        reject(error instanceof Error ? error : new Error('The operation failed', { cause: error }))
      }
    })()
  })
}

/**
 * Runs `work` with a signal that aborts once `ms` pass or `signal` aborts, so the work stops rather
 * than running on unseen, and settles as soon as either happens even if the work ignores it. A
 * deadline rejects with a `TimeoutError` (`isDeadline`), the caller's abort with its reason.
 */
export function withDeadline<T>(
  ms: number,
  work: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const bounded = anySignal([signal, AbortSignal.timeout(ms)])
  return untilAborted(work(bounded), bounded)
}

/** Waits `ms`, or rejects with the abort reason as soon as `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortReason(signal))
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      if (signal) reject(abortReason(signal))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
