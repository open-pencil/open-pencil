import type { Editor } from '@open-pencil/core/editor'
import { cloneVectorNetwork } from '@open-pencil/core/scene-graph'
import type { SceneGraph, VectorNetwork } from '@open-pencil/core/scene-graph'
import { computeAccurateBounds } from '@open-pencil/core/vector'

import { getLiveNetwork } from './network'
import type { VectorEditState } from './types'

export function createVectorEditLifecycle(
  editor: Editor,
  graph: SceneGraph,
  state: VectorEditState
) {
  function getNodeEditState() {
    return state.nodeEditState
  }

  function applyNodeEditToNode(es: NonNullable<typeof state.nodeEditState>) {
    const node = graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') return

    const live = getLiveNetwork(es)
    const bounds = computeAccurateBounds(live)
    const relativeNetwork: VectorNetwork = {
      vertices: live.vertices.map((v) => ({
        ...v,
        x: v.x - bounds.x,
        y: v.y - bounds.y
      })),
      segments: live.segments,
      regions: live.regions
    }

    graph.updateNode(node.id, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      vectorNetwork: relativeNetwork
    })
    editor.requestRender()
  }

  function enterNodeEditMode(nodeId: string) {
    const node = graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const absVertices = node.vectorNetwork.vertices.map((v) => ({
      ...v,
      x: v.x + node.x,
      y: v.y + node.y
    }))

    state.nodeEditState = {
      nodeId,
      origNetwork: cloneVectorNetwork(node.vectorNetwork),
      origBounds: { x: node.x, y: node.y, width: node.width, height: node.height },
      vertices: absVertices,
      segments: node.vectorNetwork.segments.map((s) => ({
        ...s,
        tangentStart: { ...s.tangentStart },
        tangentEnd: { ...s.tangentEnd }
      })),
      regions: node.vectorNetwork.regions.map((r) => ({
        windingRule: r.windingRule,
        loops: r.loops.map((l) => [...l])
      })),
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

    const node = graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') {
      state.nodeEditState = null
      editor.requestRender()
      return
    }

    if (commit) {
      applyNodeEditToNode(es)
    } else {
      graph.updateNode(es.nodeId, {
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
