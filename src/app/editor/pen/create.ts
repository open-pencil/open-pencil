import type { Editor, Tool } from '@open-pencil/core'
import type { VectorNetwork } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { transformVectorNetwork } from '@open-pencil/scene-graph/vector-network'

import {
  chainEndingAt,
  createResumedPenState,
  newPieceAt,
  wholeChain,
  type PenChain,
  type PenState
} from '@/app/editor/pen/resume'

// Always read editor.graph at call time: opening a file swaps the graph
// instance (editor.replaceGraph), so a captured reference goes stale.
//
// Pen state is page-absolute; resumed geometry maps through the node's world
// matrix so nested, rotated, and flipped vectors resume in place. The layer
// stays in the document while its path grows, and committing updates it.
export function createPenActions(editor: Editor, state: PenState) {
  function setTool(tool: Tool) {
    if (state.penState && tool !== 'PEN' && tool !== 'HAND') {
      editor.penCommit(false)
    }
    editor.setTool(tool)
  }

  /** Continues `nodeId`'s path with the pen, on the chain `pick` takes from its page-space network. */
  function resumeOn(nodeId: string, pick: (network: VectorNetwork) => PenChain) {
    const node = editor.graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const absNetwork = transformVectorNetwork(
      getWorldMatrix(node, editor.graph),
      node.vectorNetwork
    )
    state.penState = createResumedPenState(node, pick(absNetwork))
    editor.clearSelection()
    editor.setTool('PEN')
    editor.requestRender()
  }

  function penResumeOnPath(nodeId: string) {
    resumeOn(nodeId, wholeChain)
  }

  function penResumeFromEndpoint(nodeId: string, endpointVertexIndex: number) {
    resumeOn(nodeId, (network) => chainEndingAt(network, endpointVertexIndex))
  }

  /** Starts a new piece of `nodeId`'s path at a page point, as a pen click off the path does in Figma. */
  function penStartPiece(nodeId: string, point: Vector) {
    resumeOn(nodeId, (network) => newPieceAt(network, point))
  }

  return { setTool, penResumeOnPath, penResumeFromEndpoint, penStartPiece }
}
