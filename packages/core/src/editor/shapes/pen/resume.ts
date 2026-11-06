import type {
  SceneNode,
  VectorNetwork,
  VectorSegment,
  VectorVertex
} from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { cloneVectorNetwork } from '@open-pencil/scene-graph/copy'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { slotScope } from '@open-pencil/scene-graph/slots'
import { transformVectorNetwork } from '@open-pencil/scene-graph/vector-network'

import { getNodeEditCapability } from '#core/editor/capabilities'
import type { EditorContext, EditorState, ResumedPath } from '#core/editor/types'
import { editsHandlesOnly } from '#core/editor/vector/limits'
import { offeredTool } from '#core/editor/views'

type PenStateInit = NonNullable<EditorState['penState']>

export interface PenChain {
  vertices: VectorVertex[]
  segments: VectorSegment[]
  path: ResumedPath
}

export function createResumedPenState(node: SceneNode, chain: PenChain): PenStateInit {
  return {
    vertices: chain.vertices,
    segments: chain.segments,
    dragTangent: null,
    oppositeDragTangent: null,
    closingToFirst: false,
    pendingClose: false,
    resumingNodeId: node.id,
    resumedPath: chain.path,
    resumedFills: [...node.fills],
    resumedStrokes: [...node.strokes]
  }
}

/** The whole network as the pen's chain, in its own order. */
export function wholeChain(network: VectorNetwork): PenChain {
  // The pen moves and adds to its chain, so it gets a copy.
  const { vertices, segments } = cloneVectorNetwork(network)
  return {
    vertices,
    segments,
    path: {
      network,
      vertices: network.vertices.map((_, index) => index),
      segments: network.segments.map((_, index) => ({ index, reversed: false }))
    }
  }
}

/**
 * A chain that starts a new piece of `network` at `point`: it walks none of the network, so
 * committing adds everything the pen draws beside the pieces already there.
 */
export function newPieceAt(network: VectorNetwork, point: Vector): PenChain {
  return {
    vertices: [{ ...point }],
    segments: [],
    path: { network, vertices: [], segments: [] }
  }
}

/**
 * The chain a pen continuing from `end` draws on: walked out from `end` and turned around, so
 * `end` is its last vertex, where the pen adds the next point. At a branch the walk takes one
 * way; the branches it leaves stay in `network` and are kept when the pen commits.
 */
export function chainEndingAt(network: VectorNetwork, end: number): PenChain {
  const walk = [end]
  const walked: number[] = []
  const visited = new Set([end])
  for (;;) {
    const from = walk[walk.length - 1]
    const index = network.segments.findIndex(
      (s) => (s.start === from && !visited.has(s.end)) || (s.end === from && !visited.has(s.start))
    )
    if (index === -1) break
    const segment = network.segments[index]
    const next = segment.start === from ? segment.end : segment.start
    visited.add(next)
    walk.push(next)
    walked.push(index)
  }

  const vertices = walk.toReversed()
  const segments = walked
    .toReversed()
    .map((index, k) => ({ index, reversed: network.segments[index].start !== vertices[k] }))
  return {
    vertices: vertices.map((index) => ({ ...network.vertices[index] })),
    segments: segments.map(({ index, reversed }, k) => {
      const segment = network.segments[index]
      return {
        start: k,
        end: k + 1,
        tangentStart: { ...(reversed ? segment.tangentEnd : segment.tangentStart) },
        tangentEnd: { ...(reversed ? segment.tangentStart : segment.tangentEnd) }
      }
    }),
    path: { network, vertices, segments }
  }
}

/** What ends the edits a resumed pen takes over from. */
export interface PenResumeDeps {
  penCommit: (closed: boolean) => void
  exitNodeEditMode: (commit: boolean) => void
}

// Pen state is page-absolute; resumed geometry maps through the node's world matrix so nested,
// rotated, and flipped vectors resume in place. The layer stays in the document while its path
// grows, and committing updates it.
export function createPenResumeActions(ctx: EditorContext, deps: PenResumeDeps) {
  /** Whether the pen can continue `nodeId`'s path: an editable vector, with the pen on offer. */
  function resumable(nodeId: string) {
    const node = ctx.graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return false
    // A vector inside an instance draws its component's path, so it is not continued there.
    if (node.parentId && slotScope(ctx.graph, node.parentId).kind === 'locked') return false
    if (!getNodeEditCapability(ctx.graph, nodeId).editable) return false
    // Continuing a path adds points to it, and leaves the path open for editing.
    if (editsHandlesOnly(ctx.state) || ctx.state.nodeEditState?.keepOpen) return false
    return offeredTool(ctx.state, 'PEN') === 'PEN'
  }

  /**
   * Continues `nodeId`'s path with the pen, on the chain `pick` takes from its page-space network.
   * A path open for editing and a pen path in progress are committed first, so the pen continues
   * the path as it stands and nothing drawn is lost.
   */
  function resumeOn(nodeId: string, pick: (network: VectorNetwork) => PenChain) {
    if (!resumable(nodeId)) return
    if (ctx.state.nodeEditState) deps.exitNodeEditMode(true)
    if (ctx.state.penState) deps.penCommit(false)

    const node = ctx.graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return
    const absNetwork = transformVectorNetwork(getWorldMatrix(node, ctx.graph), node.vectorNetwork)
    ctx.state.penState = createResumedPenState(node, pick(absNetwork))
    ctx.setSelectedIds(new Set())
    ctx.setActiveTool('PEN')
    ctx.requestRender()
  }

  function penResumeOnPath(nodeId: string) {
    resumeOn(nodeId, wholeChain)
  }

  /** Continues the path from one of its points; a point that is not in the path does nothing. */
  function penResumeFromEndpoint(nodeId: string, endpointVertexIndex: number) {
    // Points are counted in the path as it is being edited, or as stored when it is not open.
    const open = ctx.state.nodeEditState
    const node = ctx.graph.getNode(nodeId)
    const count =
      open?.nodeId === nodeId ? open.vertices.length : (node?.vectorNetwork?.vertices.length ?? 0)
    if (!Number.isInteger(endpointVertexIndex) || endpointVertexIndex < 0) return
    if (endpointVertexIndex >= count) return
    resumeOn(nodeId, (network) => chainEndingAt(network, endpointVertexIndex))
  }

  /** Starts a new piece of `nodeId`'s path at a page point, as a pen click off the path does in Figma. */
  function penStartPiece(nodeId: string, point: Vector) {
    resumeOn(nodeId, (network) => newPieceAt(network, point))
  }

  return { penResumeOnPath, penResumeFromEndpoint, penStartPiece }
}
