import type { Editor } from '@open-pencil/core/editor'
import { cloneVectorNetwork } from '@open-pencil/scene-graph'
import type { VectorNetwork } from '@open-pencil/scene-graph'

import type { NodeEditState, VectorEditState } from './types'

function snapshot(es: NodeEditState): VectorNetwork {
  return cloneVectorNetwork({ vertices: es.vertices, segments: es.segments, regions: es.regions })
}

function sameGeometry(a: VectorNetwork, b: VectorNetwork) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Snapshot the current geometry onto the session undo stack (call BEFORE mutating). */
export function pushNodeEditHistory(es: NodeEditState) {
  es.future = []
  es.history.push(snapshot(es))
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
    // Drag-start snapshots can be no-ops (click without move) — skip those
    let entry = es.history.pop()
    while (entry && sameGeometry(entry, current)) entry = es.history.pop()
    if (!entry) return
    es.future.push(current)
    restore(es, entry)
  }

  function nodeEditRedo() {
    const es = state.nodeEditState
    if (!es) return
    const next = es.future.pop()
    if (!next) return
    es.history.push(snapshot(es))
    restore(es, next)
  }

  return { nodeEditPushHistory, nodeEditUndo, nodeEditRedo }
}
