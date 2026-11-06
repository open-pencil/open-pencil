import type { EditorStore } from '@/app/editor/active-store'
import { createDeferred } from '@/app/runtime/deferred'

/** Runs holders one at a time, in arrival order. `acquire` resolves with the release function. */
function createMutex() {
  let tail: Promise<unknown> = Promise.resolve()
  return async function acquire(): Promise<() => void> {
    const { promise, resolve } = createDeferred<undefined>()
    const previous = tail
    tail = previous.then(() => promise)
    await previous
    return () => resolve(undefined)
  }
}

const editLocks = new WeakMap<EditorStore, () => Promise<() => void>>()

/**
 * Waits for the document's turn to edit and resolves with the function that ends it. Agents'
 * edits (tool calls from any client, and scripts) take turns, since each records everything
 * that changes in the document while it runs.
 */
export function acquireDocumentEdit(store: EditorStore): Promise<() => void> {
  let lock = editLocks.get(store)
  if (!lock) {
    lock = createMutex()
    editLocks.set(store, lock)
  }
  return lock()
}
