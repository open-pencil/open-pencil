import { untilAborted } from '@open-pencil/std/timing'

import { graphOf } from './graph'

/** The signal that cancels the script each API object runs, from `FigmaAPIOptions.signal`. */
const scriptSignals = new WeakMap<object, AbortSignal>()

/** Cancels waits started through `api` once `signal` aborts. */
export function cancelScriptWaits(api: object, signal: AbortSignal): void {
  scriptSignals.set(api, signal)
}

/**
 * Runs `start`, I/O a script asked for through the plugin API `api` such as a font or image
 * download or a page load, outside the edit recording the script (`SceneGraph.waitOutsideEdit`),
 * so what changes meanwhile, such as the user's edit or the page's saved layers, stays out of the
 * script's undo step. A cancelled script stops waiting: the call rejects with the reason it was
 * cancelled, and one cancelled before the work started never starts it.
 *
 * The work starts, and the wait leaves the edit, once the script's code that asked for it has run
 * up to its next await, so a write the script makes right after the call stays its own. A script
 * that awaits something else first and writes while this wait is still pending, through
 * `Promise.all` or its own timers, has that write taken as someone else's: nothing tells whose
 * write is whose while both wait.
 */
export async function waitOutsideScript<T>(api: object, start: () => Promise<T>): Promise<T> {
  const signal = scriptSignals.get(api)
  signal?.throwIfAborted()
  await Promise.resolve()
  // The work starts in a callback, after `waitOutsideEdit` has paused the edit, so what it does
  // synchronously, such as bringing a page's saved layers in, stays outside the edit too.
  return graphOf(api).waitOutsideEdit(
    Promise.resolve().then(() => {
      // Cancelled while the script ran on to its await.
      signal?.throwIfAborted()
      const work = start()
      return signal ? untilAborted(work, signal) : work
    })
  )
}
