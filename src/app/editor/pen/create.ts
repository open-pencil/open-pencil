import type { Editor, Tool } from '@open-pencil/core/editor'
import { transformVectorNetwork } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'

import {
  createResumedPenState,
  walkChainOrdered,
  walkChainToEnd,
  type PenState
} from '@/app/editor/pen/resume'

// Always read editor.graph at call time: opening a file swaps the graph
// instance (editor.replaceGraph), so a captured reference goes stale.
//
// Pen state is page-absolute; resumed geometry maps through the node's world
// matrix so nested, rotated, and flipped vectors resume in place.
export function createPenActions(editor: Editor, state: PenState) {
  function setTool(tool: Tool) {
    if (state.penState && tool !== 'PEN' && tool !== 'HAND') {
      editor.penCommit(false)
    }
    editor.setTool(tool)
  }

  function penResumeOnPath(nodeId: string) {
    const node = editor.graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const absNetwork = transformVectorNetwork(
      getWorldMatrix(node, editor.graph),
      node.vectorNetwork
    )
    state.penState = createResumedPenState(node, absNetwork.vertices, absNetwork.segments)

    editor.graph.deleteNode(nodeId)
    editor.clearSelection()
    editor.setTool('PEN')
    editor.requestRender()
  }

  function penResumeFromEndpoint(nodeId: string, endpointVertexIndex: number) {
    const node = editor.graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const absNetwork = transformVectorNetwork(
      getWorldMatrix(node, editor.graph),
      node.vectorNetwork
    )
    const absVertices = absNetwork.vertices
    const absSegments = absNetwork.segments
    const otherEnd = walkChainToEnd(absSegments, endpointVertexIndex)
    const { orderedVertices, orderedSegments } = walkChainOrdered(
      absVertices,
      absSegments,
      otherEnd
    )

    state.penState = createResumedPenState(node, orderedVertices, orderedSegments)
    editor.graph.deleteNode(nodeId)
    editor.clearSelection()
    editor.setTool('PEN')
    editor.requestRender()
  }

  return { setTool, penResumeOnPath, penResumeFromEndpoint }
}
