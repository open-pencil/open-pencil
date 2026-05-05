import type { Editor, Tool } from '@open-pencil/core/editor'
import type { SceneGraph } from '@open-pencil/core/scene-graph'

import {
  absoluteVertices,
  cloneSegments,
  createResumedPenState,
  walkChainOrdered,
  walkChainToEnd,
  type PenState
} from '@/app/editor/pen/resume'

export function createPenActions(editor: Editor, graph: SceneGraph, state: PenState) {
  function setTool(tool: Tool) {
    if (state.penState && tool !== 'PEN' && tool !== 'HAND') {
      editor.penCommit(false)
    }
    state.activeTool = tool
  }

  function penResumeOnPath(nodeId: string) {
    const node = graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    state.penState = createResumedPenState(
      node,
      absoluteVertices(node, node.vectorNetwork.vertices),
      cloneSegments(node.vectorNetwork.segments)
    )

    graph.deleteNode(nodeId)
    state.selectedIds = new Set()
    state.activeTool = 'PEN'
    editor.requestRender()
  }

  function penResumeFromEndpoint(nodeId: string, endpointVertexIndex: number) {
    const node = graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const absVertices = absoluteVertices(node, node.vectorNetwork.vertices)
    const absSegments = cloneSegments(node.vectorNetwork.segments)
    const otherEnd = walkChainToEnd(absSegments, endpointVertexIndex)
    const { orderedVertices, orderedSegments } = walkChainOrdered(
      absVertices,
      absSegments,
      otherEnd
    )

    state.penState = createResumedPenState(node, orderedVertices, orderedSegments)
    graph.deleteNode(nodeId)
    state.selectedIds = new Set()
    state.activeTool = 'PEN'
    editor.requestRender()
  }

  return { setTool, penResumeOnPath, penResumeFromEndpoint }
}
