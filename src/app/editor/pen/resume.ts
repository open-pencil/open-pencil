import type { EditorState } from '@open-pencil/core/editor'
import type { Fill, SceneNode, VectorSegment, VectorVertex } from '@open-pencil/core/scene-graph'

type ResumablePenState = NonNullable<EditorState['penState']> & {
  resumingNodeId?: string
  resumedFills?: Fill[]
  resumedStrokes?: SceneNode['strokes']
}

export type PenState = Omit<EditorState, 'penState'> & {
  penState: ResumablePenState | null
}

export function absoluteVertices(node: SceneNode, vertices: VectorVertex[]): VectorVertex[] {
  return vertices.map((v) => ({
    ...v,
    x: v.x + node.x,
    y: v.y + node.y
  }))
}

export function cloneSegments(segments: VectorSegment[]): VectorSegment[] {
  return segments.map((s) => ({
    ...s,
    tangentStart: { ...s.tangentStart },
    tangentEnd: { ...s.tangentEnd }
  }))
}

export function createResumedPenState(
  node: SceneNode,
  vertices: VectorVertex[],
  segments: VectorSegment[]
): ResumablePenState {
  return {
    vertices,
    segments,
    dragTangent: null,
    oppositeDragTangent: null,
    closingToFirst: false,
    pendingClose: false,
    resumingNodeId: node.id,
    resumedFills: [...node.fills],
    resumedStrokes: [...node.strokes]
  }
}

export function walkChainToEnd(segments: { start: number; end: number }[], start: number): number {
  let current = start
  const visited = new Set<number>([start])
  for (;;) {
    let found = false
    for (const seg of segments) {
      let next = -1
      if (seg.start === current && !visited.has(seg.end)) next = seg.end
      else if (seg.end === current && !visited.has(seg.start)) next = seg.start
      if (next === -1) continue
      visited.add(next)
      current = next
      found = true
      break
    }
    if (!found) break
  }
  return current
}

export function walkChainOrdered(
  absVertices: VectorVertex[],
  absSegments: VectorSegment[],
  start: number
): { orderedVertices: VectorVertex[]; orderedSegments: VectorSegment[] } {
  const orderedVertices: VectorVertex[] = []
  const orderedSegments: VectorSegment[] = []
  const visited = new Set<number>()
  let current = start

  orderedVertices.push(absVertices[current])
  visited.add(current)

  for (;;) {
    let foundSeg = false
    for (const seg of absSegments) {
      let next = -1
      let isForward = false
      if (seg.start === current && !visited.has(seg.end)) {
        next = seg.end
        isForward = true
      } else if (seg.end === current && !visited.has(seg.start)) {
        next = seg.start
      }
      if (next === -1) continue

      const fromIdx = orderedVertices.length - 1
      orderedVertices.push(absVertices[next])
      const toIdx = orderedVertices.length - 1

      orderedSegments.push({
        start: fromIdx,
        end: toIdx,
        tangentStart: isForward ? { ...seg.tangentStart } : { ...seg.tangentEnd },
        tangentEnd: isForward ? { ...seg.tangentEnd } : { ...seg.tangentStart }
      })

      visited.add(next)
      current = next
      foundSeg = true
      break
    }
    if (!foundSeg) break
  }
  return { orderedVertices, orderedSegments }
}
