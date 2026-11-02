import type { Editor } from '@open-pencil/core'
import { nearestPointOnNetwork, regionAtPoint, vectorHandleParts } from '@open-pencil/core/vector'
import type { VectorRegion, VectorSegment, VectorVertex } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

export type NodeEditState = {
  nodeId: string
  vertices: VectorVertex[]
  segments: VectorSegment[]
  regions: VectorRegion[]
  selectedVertexIndices: Set<number>
  selectedSegmentIndices: Set<number>
  selectedHandles: Set<number>
  hoveredHandleInfo: {
    segmentIndex: number
    tangentField: 'tangentStart' | 'tangentEnd'
  } | null
  hoveredRegion?: number | null
  selectedRegions?: Set<number>
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

/** The segment of the path being edited under a canvas point, outside its points. */
export function hitTestEditSegment(editor: Editor, cx: number, cy: number): number | null {
  const es = getNodeEditState(editor)
  if (!es) return null
  const network = { vertices: es.vertices, segments: es.segments, regions: [] }
  const hit = nearestPointOnNetwork(cx, cy, network, NODE_HIT_THRESHOLD / editor.state.zoom)
  return hit?.segmentIndex ?? null
}

/**
 * How close, in screen pixels, a point or a segment keeps the pointer from a region, as in
 * Figma: a region under the pointer wins unless a point is within 4 px or a segment within 2.667 px.
 */
const REGION_POINT_CLEARANCE = 4
const REGION_SEGMENT_CLEARANCE = 8 / 3

/** The region of the path being edited under a canvas point, unless a point or segment is closer. */
export function hitTestEditRegion(editor: Editor, cx: number, cy: number): number | null {
  const es = getNodeEditState(editor)
  if (!es || es.regions.length === 0) return null
  const iz = 1 / editor.state.zoom
  if (es.vertices.some((v) => Math.hypot(cx - v.x, cy - v.y) <= REGION_POINT_CLEARANCE * iz)) {
    return null
  }
  const network = { vertices: es.vertices, segments: es.segments, regions: es.regions }
  if (nearestPointOnNetwork(cx, cy, network, REGION_SEGMENT_CLEARANCE * iz)) return null
  // Past the segment clearance the point is off every edge, so half of it bounds the curve error.
  return regionAtPoint(network, { x: cx, y: cy }, (REGION_SEGMENT_CLEARANCE * iz) / 2)
}

/** The points of the path being edited that lie inside a canvas rectangle. */
export function editVerticesInRect(editor: Editor, rect: Rect): number[] {
  const es = getNodeEditState(editor)
  if (!es) return []
  return es.vertices.flatMap((vertex, index) =>
    vertex.x >= rect.x &&
    vertex.x <= rect.x + rect.width &&
    vertex.y >= rect.y &&
    vertex.y <= rect.y + rect.height
      ? [index]
      : []
  )
}

function getHandleVisibleVertices(editor: Editor): Set<number> {
  const es = getNodeEditState(editor)
  if (!es) return new Set()
  const seed = new Set(es.selectedVertexIndices)
  for (const handleId of es.selectedHandles) {
    const handle = vectorHandleParts(handleId)
    if (!handle || handle.segmentIndex >= es.segments.length) continue
    const seg = es.segments[handle.segmentIndex]
    seed.add(handle.tangentField === 'tangentStart' ? seg.start : seg.end)
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
