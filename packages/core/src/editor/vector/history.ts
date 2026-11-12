import type { VectorNetwork } from '@open-pencil/scene-graph'
import { cloneVectorNetwork } from '@open-pencil/scene-graph/copy'

import type { EditorContext } from '#core/editor/types'

import { setNodeEditNetwork } from './network'
import type { NodeEditState } from './types'

/**
 * Where a path's changes become undo steps. Vector edit mode has no history of its own: each change
 * is committed to the layer as one step of the document's history (Figma), when the drag that
 * made it ends or, for a change made at once, when the next one starts or undo runs.
 */
export interface VectorEditHistory {
  /** Commits what changed since the last step and remembers the path as the next change starts. */
  begin(es: NodeEditState): void
  /** Puts the path back as it was when the change in progress started, with no step. */
  cancel(es: NodeEditState): void
}

export function createVectorEditHistory(
  ctx: EditorContext,
  commit: (es: NodeEditState) => void
): VectorEditHistory {
  // Undo and redo act on the newest change, so one not committed yet is committed first.
  let stopSettling: (() => void) | null = null
  function stop() {
    stopSettling?.()
    stopSettling = null
  }
  function settle() {
    stop()
    const es = ctx.state.nodeEditState
    if (es) commit(es)
  }

  function begin(es: NodeEditState) {
    commit(es)
    es.changeStart = snapshot(es)
    stopSettling ??= ctx.undo.onBeforeHistory(settle)
  }

  function cancel(es: NodeEditState) {
    stop()
    if (!es.changeStart) return
    setNodeEditNetwork(es, es.changeStart)
    es.changeStart = null
    ctx.requestRender()
  }

  return { begin, cancel }
}

function snapshot(es: NodeEditState): VectorNetwork {
  return cloneVectorNetwork({ vertices: es.vertices, segments: es.segments, regions: es.regions })
}
