import type { EditorStore } from '@/app/editor/active-store'
import { withAbortSignal } from '@/app/runtime/abort'
import { createDeferred } from '@/app/runtime/deferred'

/**
 * Runs holders one at a time, in arrival order. `acquire` resolves with the release function; a
 * holder whose signal aborts while it waits stops waiting, and its turn passes straight on.
 */
function createMutex() {
  let tail: Promise<unknown> = Promise.resolve()
  return async function acquire(signal?: AbortSignal): Promise<() => void> {
    signal?.throwIfAborted()
    const { promise, resolve } = createDeferred<undefined>()
    const release = () => resolve(undefined)
    const previous = tail
    tail = previous.then(() => promise)
    if (!signal) {
      await previous
      return release
    }
    try {
      await withAbortSignal(previous, signal)
    } catch (error) {
      void previous.then(release)
      throw error
    }
    return release
  }
}

const editLocks = new WeakMap<EditorStore, (signal?: AbortSignal) => Promise<() => void>>()

/**
 * Waits for the document's turn to edit and resolves with the function that ends it. Agents'
 * edits (tool calls from any client, and scripts) take turns, since each records everything
 * that changes in the document while it runs. A call cancelled while it waits, such as one its
 * MCP client stopped waiting for, rejects and never edits.
 */
export function acquireDocumentEdit(store: EditorStore, signal?: AbortSignal): Promise<() => void> {
  let lock = editLocks.get(store)
  if (!lock) {
    lock = createMutex()
    editLocks.set(store, lock)
  }
  return lock(signal)
}
