import type { Editor } from '@open-pencil/core/editor'
import { cloneVectorNetwork, vectorNetworksEqual } from '@open-pencil/scene-graph'
import type { VectorNetwork } from '@open-pencil/scene-graph'

import type { NodeEditState, VectorEditState } from './types'

function snapshot(es: NodeEditState): VectorNetwork {
  return cloneVectorNetwork({ vertices: es.vertices, segments: es.segments, regions: es.regions })
}

/** Snapshot the current geometry onto the session undo stack (call BEFORE mutating).
 *  Redo entries are NOT cleared here — pointer-down alone is not a change; stale
 *  redo entries are dropped lazily once a real geometry change is observed. */
export function pushNodeEditHistory(es: NodeEditState) {
  es.history.push(snapshot(es))
}

/** Drop redo entries when the geometry diverged from the last undo/redo restore
 *  point — i.e. a real change happened, which invalidates the redo timeline. */
function invalidateStaleFuture(es: NodeEditState, current: VectorNetwork) {
  if (!es.futureBaseline || es.future.length === 0) return
  if (!vectorNetworksEqual(es.futureBaseline, current)) {
    es.future = []
    es.futureBaseline = null
  }
}

export function createVectorEditHistoryActions(editor: Editor, state: VectorEditState) {
  function nodeEditPushHistory() {
    const es = state.nodeEditState
    if (es) pushNodeEditHistory(es)
  }

  function restore(es: NodeEditState, network: VectorNetwork) {
    const clone = cloneVectorNetwork(network)
    es.vertices = clone.vertices
    es.segments = clone.segments
    es.regions = clone.regions
    es.futureBaseline = cloneVectorNetwork(network)
    // indices may no longer exist in the restored geometry
    es.selectedVertexIndices = new Set()
    es.selectedHandles = new Set()
    es.hoveredHandleInfo = null
    editor.requestRender()
  }

  function nodeEditUndo() {
    const es = state.nodeEditState
    if (!es) return
    const current = snapshot(es)
    invalidateStaleFuture(es, current)
    // Drag-start snapshots can be no-ops (click without move) — skip those
    let entry = es.history.pop()
    while (entry && vectorNetworksEqual(entry, current)) entry = es.history.pop()
    if (!entry) return
    es.future.push(current)
    restore(es, entry)
  }

  function nodeEditRedo() {
    const es = state.nodeEditState
    if (!es) return
    const current = snapshot(es)
    invalidateStaleFuture(es, current)
    const next = es.future.pop()
    if (!next) return
    es.history.push(current)
    restore(es, next)
  }

  return { nodeEditPushHistory, nodeEditUndo, nodeEditRedo }
}
