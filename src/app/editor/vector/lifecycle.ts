import type { Editor } from '@open-pencil/core'
import { vectorChangesFromPagePath } from '@open-pencil/core/vector'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { cloneVectorNetwork } from '@open-pencil/scene-graph/copy'
import { slotScope } from '@open-pencil/scene-graph/slots'
import {
  transformVectorNetwork,
  vectorNetworksEqual
} from '@open-pencil/scene-graph/vector-network'

import { getLiveNetwork } from './network'
import type { VectorEditState } from './types'

// Always read editor.graph at call time: opening a file swaps the graph
// instance (editor.replaceGraph), so a captured reference goes stale.
//
// Edit-state geometry lives in page-absolute space, mapped through the node's
// full world matrix so nested, rotated, and flipped nodes edit correctly.
export function createVectorEditLifecycle(editor: Editor, state: VectorEditState) {
  function getNodeEditState() {
    return state.nodeEditState
  }

  // A path whose layer is gone, by undo, a script, or another document, has nothing to edit.
  const close = () => {
    state.nodeEditState = null
    state.snapGuides = []
    editor.requestRender()
  }
  editor.onEditorEvent('node:deleted', (id) => {
    if (state.nodeEditState?.nodeId === id) close()
  })
  editor.onEditorEvent('graph:replaced', () => {
    if (state.nodeEditState) close()
  })

  function commitNodeEditChanges(es: NonNullable<typeof state.nodeEditState>) {
    const node = editor.graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') return

    // Session geometry only changes through explicit edits, so an exact
    // comparison detects a no-op session — skip it to keep undo clean.
    if (vectorNetworksEqual(getLiveNetwork(es), es.origAbsNetwork)) return

    const changes = vectorChangesFromPagePath(editor.graph, node, getLiveNetwork(es))
    if (!changes) return
    editor.updateNodeWithUndo(node.id, changes, 'Edit vector')
    const committed = editor.graph.getNode(es.nodeId)
    if (committed?.type === 'VECTOR' && committed.vectorNetwork) {
      const committedWorld = getWorldMatrix(committed, editor.graph)
      es.origNetwork = cloneVectorNetwork(committed.vectorNetwork)
      es.origBounds = {
        x: committed.x,
        y: committed.y,
        width: committed.width,
        height: committed.height
      }
      es.origAbsNetwork = cloneVectorNetwork(
        transformVectorNetwork(committedWorld, committed.vectorNetwork)
      )
    }
    editor.requestRender()
  }

  function enterNodeEditMode(nodeId: string) {
    const node = editor.graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return
    // A vector inside an instance draws its component's path, so Figma does not open it.
    if (node.parentId && slotScope(editor.graph, node.parentId).kind === 'locked') return

    const world = getWorldMatrix(node, editor.graph)
    const absNetwork = transformVectorNetwork(world, node.vectorNetwork)

    state.snapGuides = []
    state.nodeEditState = {
      nodeId,
      origNetwork: cloneVectorNetwork(node.vectorNetwork),
      origBounds: { x: node.x, y: node.y, width: node.width, height: node.height },
      origAbsNetwork: cloneVectorNetwork(absNetwork),
      vertices: absNetwork.vertices,
      segments: absNetwork.segments,
      regions: absNetwork.regions,
      history: [],
      future: [],
      selectedVertexIndices: new Set(),
      selectedSegmentIndices: new Set(),
      draggedHandleInfo: null,
      selectedHandles: new Set(),
      hoveredHandleInfo: null,
      hoveredRegion: null,
      selectedRegions: new Set()
    }

    editor.select([nodeId])
    editor.requestRender()
  }

  function exitNodeEditMode(commit: boolean) {
    const es = getNodeEditState()
    if (!es) return
    state.snapGuides = []
    editor.requestRender()

    const node = editor.graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') {
      state.nodeEditState = null
      editor.requestRender()
      return
    }

    if (commit) {
      commitNodeEditChanges(es)
    } else {
      editor.graph.updateNode(es.nodeId, {
        x: es.origBounds.x,
        y: es.origBounds.y,
        width: es.origBounds.width,
        height: es.origBounds.height,
        vectorNetwork: cloneVectorNetwork(es.origNetwork)
      })
      editor.requestRender()
    }

    state.nodeEditState = null
  }

  return { getNodeEditState, commitNodeEditChanges, enterNodeEditMode, exitNodeEditMode }
}
