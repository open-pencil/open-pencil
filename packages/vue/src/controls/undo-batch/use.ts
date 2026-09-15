import { tryOnScopeDispose, useTimeoutFn } from '@vueuse/core'
import { getCurrentInstance, onDeactivated } from 'vue'

import type { UndoManager } from '@open-pencil/scene-graph'

const BATCH_IDLE_MS = 300

export function useUndoBatch(undo: UndoManager, beginInteractiveEdit?: () => () => void) {
  let batchKey: string | null = null
  let endInteraction: (() => void) | undefined

  function commitActiveBatch() {
    if (batchKey !== null) {
      try {
        undo.commitBatch()
      } finally {
        batchKey = null
        endInteraction?.()
        endInteraction = undefined
      }
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
    if (batchKey === null && undo.isBatching) return
    if (batchKey !== key) {
      flush()
      undo.beginBatch(label)
      endInteraction = beginInteractiveEdit?.()
      batchKey = key
    }
    scheduleFlush()
  }

  tryOnScopeDispose(flush)
  // These are applied property-list edits, not owned previews. Preserve the
  // normal unmount behavior; preview owners cancel unfinished interactions.
  if (getCurrentInstance()) onDeactivated(flush)

  return { ensure, flush }
}
