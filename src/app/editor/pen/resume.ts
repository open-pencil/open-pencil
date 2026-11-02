import type { EditorState, ResumedPath } from '@open-pencil/core'
import type {
  SceneNode,
  VectorNetwork,
  VectorSegment,
  VectorVertex
} from '@open-pencil/scene-graph'
import { cloneVectorNetwork } from '@open-pencil/scene-graph/copy'
import type { Vector } from '@open-pencil/scene-graph/primitives'

export type PenState = EditorState
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
