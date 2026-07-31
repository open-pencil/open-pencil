import type { Editor } from '@open-pencil/core/editor'
import { computeAccurateBounds, regenerateFillGeometry } from '@open-pencil/core/vector'
import {
  cloneVectorNetwork,
  transformVectorNetwork,
  vectorNetworksEqual
} from '@open-pencil/scene-graph'
import type { VectorNetwork } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

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

  function applyNodeEditToNode(es: NonNullable<typeof state.nodeEditState>) {
    const node = editor.graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') return

    // Session geometry only changes through explicit edits, so an exact
    // comparison detects a no-op session — skip it to keep undo clean.
    if (vectorNetworksEqual(getLiveNetwork(es), es.origAbsNetwork)) return

    const world = getWorldMatrix(node, editor.graph)
    const inverse = Matrix.invert(world)
    if (!inverse) return

    // Map the edited page-absolute network back into the node's local frame
    const localNetwork = transformVectorNetwork(inverse, getLiveNetwork(es))
    const bounds = computeAccurateBounds(localNetwork)
    const relativeNetwork: VectorNetwork = {
      vertices: localNetwork.vertices.map((v) => ({
        ...v,
        x: v.x - bounds.x,
        y: v.y - bounds.y
      })),
      segments: localNetwork.segments,
      regions: localNetwork.regions
    }

    // The node rotates/flips about its center, so with rotation preserved the
    // new x/y follow from where the new geometry's center lands in the parent
    // frame (via the OLD local matrix — the geometry itself has not moved).
    const localMatrix = getNodeLocalMatrix(node)
    const center = Matrix.mapPoint(localMatrix, {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    })

    editor.updateNodeWithUndo(
      node.id,
      {
        x: center.x - bounds.width / 2,
        y: center.y - bounds.height / 2,
        width: bounds.width,
        height: bounds.height,
        vectorNetwork: relativeNetwork,
        // Fills render from fillGeometry blobs when present — rebuild them from
        // the edited network so fills follow the edit.
        fillGeometry: regenerateFillGeometry(relativeNetwork, node.fillGeometry),
        // Drop stale imported stroke outline blobs; post-edit strokes come from
        // the live vector network path.
        strokeGeometry: []
      },
      'Edit vector'
    )
    editor.requestRender()
  }

  function enterNodeEditMode(nodeId: string) {
    const node = editor.graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const world = getWorldMatrix(node, editor.graph)
    const absNetwork = transformVectorNetwork(world, node.vectorNetwork)

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
      draggedHandleInfo: null,
      selectedHandles: new Set(),
      hoveredHandleInfo: null
    }

    editor.select([nodeId])
    editor.requestRender()
  }

  function exitNodeEditMode(commit: boolean) {
    const es = getNodeEditState()
    if (!es) return

    const node = editor.graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') {
      state.nodeEditState = null
      editor.requestRender()
      return
    }

    if (commit) {
      applyNodeEditToNode(es)
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

  return { getNodeEditState, applyNodeEditToNode, enterNodeEditMode, exitNodeEditMode }
}
