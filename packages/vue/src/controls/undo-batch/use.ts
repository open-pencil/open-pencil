import { tryOnScopeDispose, useTimeoutFn } from '@vueuse/core'

import type { UndoManager } from '@open-pencil/core/scene-graph'

const BATCH_IDLE_MS = 300

export function useUndoBatch(undo: UndoManager) {
  let batchKey: string | null = null

  function commitActiveBatch() {
    if (batchKey !== null) {
      undo.commitBatch()
      batchKey = null
    }
  }

  const { start: scheduleFlush, stop: cancelFlush } = useTimeoutFn(
    commitActiveBatch,
    BATCH_IDLE_MS,
    { immediate: false }
  )

  function flush() {
    cancelFlush()
    commitActiveBatch()
  }

  function ensure(key: string, label: string) {
    if (batchKey !== key) {
      flush()
      undo.beginBatch(label)
      batchKey = key
    }
    scheduleFlush()
  }

  tryOnScopeDispose(flush)

  return { ensure, flush }
}
