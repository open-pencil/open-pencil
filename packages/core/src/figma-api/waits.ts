import { graphOf } from './graph'

/** The signal that cancels the script each API object runs, from `FigmaAPIOptions.signal`. */
const scriptSignals = new WeakMap<object, AbortSignal>()

/** Cancels waits started through `api` once `signal` aborts. */
export function cancelScriptWaits(api: object, signal: AbortSignal): void {
  scriptSignals.set(api, signal)
}

/** `promise`, or a rejection with the abort reason once `signal` aborts. */
async function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  let stop: () => void = () => undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    stop = () =>
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException('The operation was aborted', 'AbortError')
      )
    signal.addEventListener('abort', stop, { once: true })
  })
  try {
    return await Promise.race([promise, aborted])
  } finally {
    signal.removeEventListener('abort', stop)
  }
}

/**
 * Waits for `promise`, I/O a script started through the plugin API `api` such as a font or image
 * download, outside the edit recording the script (`SceneGraph.waitOutsideEdit`), so an edit made
 * meanwhile, such as the user's, stays out of the script's undo step. A script that was cancelled
 * stops waiting: the call rejects with the reason it was cancelled.
 *
 * The wait leaves the edit only once the script's code that started it has run up to its next
 * await, so a write the script makes right after the call stays its own. A script that awaits
 * something else first and writes while this wait is still pending, through `Promise.all` or
 * its own timers, has that write taken as someone else's: nothing tells whose write is whose
 * while both wait.
 */
export async function waitOutsideScript<T>(api: object, promise: Promise<T>): Promise<T> {
  const signal = scriptSignals.get(api)
  signal?.throwIfAborted()
  await Promise.resolve()
  return graphOf(api).waitOutsideEdit(signal ? untilAborted(promise, signal) : promise)
}
