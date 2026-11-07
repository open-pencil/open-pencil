import type { SceneGraph } from '@open-pencil/scene-graph'

/**
 * Waits for `promise`, I/O a script started through the plugin API such as a font or image
 * download, outside the edit recording the script (`SceneGraph.waitOutsideEdit`), so an edit made
 * meanwhile, such as the user's, stays out of the script's undo step.
 *
 * The wait leaves the edit only once the script's code that started it has run up to its next
 * await, so a write the script makes right after the call stays its own. A script that awaits
 * something else first and writes while this wait is still pending, through `Promise.all` or
 * its own timers, has that write taken as someone else's: nothing tells whose write is whose
 * while both wait.
 */
export async function waitOutsideScript<T>(graph: SceneGraph, promise: Promise<T>): Promise<T> {
  await Promise.resolve()
  return graph.waitOutsideEdit(promise)
}
