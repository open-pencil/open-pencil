import type { Editor } from '@open-pencil/core/editor'
import type { VectorSegment, VectorVertex } from '@open-pencil/core/scene-graph'

export type NodeEditState = {
  nodeId: string
  vertices: VectorVertex[]
  segments: VectorSegment[]
  selectedVertexIndices: Set<number>
  selectedHandles: Set<string>
  hoveredHandleInfo: {
    segmentIndex: number
    tangentField: 'tangentStart' | 'tangentEnd'
  } | null
}

export function getNodeEditState(editor: Editor): NodeEditState | null {
  return (editor.state.nodeEditState as NodeEditState | null) ?? null
}

export const NODE_HIT_THRESHOLD = 8
const HANDLE_HIT_THRESHOLD_NE = 6

export function isEndpoint(vertexIndex: number, segments: VectorSegment[]): boolean {
  let count = 0
  for (const seg of segments) {
    if (seg.start === vertexIndex || seg.end === vertexIndex) count++
  }
  return count === 1
}

export function hitTestEditVertex(editor: Editor, cx: number, cy: number): number | null {
  const es = getNodeEditState(editor)
  if (!es) return null
  const iz = 1 / editor.state.zoom
  for (let i = 0; i < es.vertices.length; i++) {
    const v = es.vertices[i]
    if (Math.hypot(cx - v.x, cy - v.y) < NODE_HIT_THRESHOLD * iz) return i
  }
  return null
}

function getHandleVisibleVertices(editor: Editor): Set<number> {
  const es = getNodeEditState(editor)
  if (!es) return new Set()
  const seed = new Set(es.selectedVertexIndices)
  for (const key of es.selectedHandles) {
    const [siStr, tf] = key.split(':')
    const seg = es.segments[Number(siStr)]
    seed.add(tf === 'tangentStart' ? seg.start : seg.end)
  }
  const visible = new Set(seed)
  for (const seg of es.segments) {
    if (seed.has(seg.start)) visible.add(seg.end)
    if (seed.has(seg.end)) visible.add(seg.start)
  }
  return visible
}

export function hitTestEditHandle(
  editor: Editor,
  cx: number,
  cy: number
): {
  segmentIndex: number
  tangentField: 'tangentStart' | 'tangentEnd'
  vertexIndex: number
} | null {
  const es = getNodeEditState(editor)
  if (!es) return null
  const iz = 1 / editor.state.zoom
  const visible = getHandleVisibleVertices(editor)

  for (let si = 0; si < es.segments.length; si++) {
    const seg = es.segments[si]

    if (visible.has(seg.start)) {
      const ts = seg.tangentStart
      if (ts.x !== 0 || ts.y !== 0) {
        const hx = es.vertices[seg.start].x + ts.x
        const hy = es.vertices[seg.start].y + ts.y
        if (Math.hypot(cx - hx, cy - hy) < HANDLE_HIT_THRESHOLD_NE * iz) {
          return { segmentIndex: si, tangentField: 'tangentStart', vertexIndex: seg.start }
        }
      }
    }

    if (visible.has(seg.end)) {
      const te = seg.tangentEnd
      if (te.x !== 0 || te.y !== 0) {
        const hx = es.vertices[seg.end].x + te.x
        const hy = es.vertices[seg.end].y + te.y
        if (Math.hypot(cx - hx, cy - hy) < HANDLE_HIT_THRESHOLD_NE * iz) {
          return { segmentIndex: si, tangentField: 'tangentEnd', vertexIndex: seg.end }
        }
      }
    }
  }
  return null
}
