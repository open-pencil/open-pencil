import { createMutex, type Mutex } from '@open-pencil/std/async'

import type { EditorStore } from '@/app/editor/active-store'

const editLocks = new WeakMap<EditorStore, Mutex>()

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
  return lock.acquire(signal)
}
