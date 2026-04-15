import { onBeforeUnmount } from 'vue'

import type { UndoManager } from '@open-pencil/core'

const BATCH_IDLE_MS = 300

export function useUndoBatch(undo: UndoManager) {
  let batchKey: string | null = null
  let batchTimer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    if (batchTimer !== null) {
      clearTimeout(batchTimer)
      batchTimer = null
    }
    if (batchKey !== null) {
      undo.commitBatch()
      batchKey = null
    }
  }

  function ensure(key: string, label: string) {
    if (batchKey !== key) {
      flush()
      undo.beginBatch(label)
      batchKey = key
    }
    if (batchTimer !== null) clearTimeout(batchTimer)
    batchTimer = setTimeout(flush, BATCH_IDLE_MS)
  }

  onBeforeUnmount(flush)

  return { ensure, flush }
}
