import type { VectorSegment } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

export type VectorHandleField = 'tangentStart' | 'tangentEnd'

export function vectorHandleId(segmentIndex: number, tangentField: VectorHandleField): number {
  return segmentIndex * 2 + (tangentField === 'tangentEnd' ? 1 : 0)
}

export function vectorHandleParts(
  handleId: number
): { segmentIndex: number; tangentField: VectorHandleField } | null {
  if (!Number.isSafeInteger(handleId) || handleId < 0) return null
  const segmentIndex = Math.floor(handleId / 2)
  return {
    segmentIndex,
    tangentField: handleId % 2 === 0 ? 'tangentStart' : 'tangentEnd'
  }
}

/**
 * Which points of a path being edited show their handles: those near the selection, as Figma
 * shows them, or every point.
 */
export type ShownHandles = 'near-selection' | 'all'

/** What decides which handles of a path being edited show. */
export interface HandleVisibilityState {
  vertices: readonly unknown[]
  segments: readonly VectorSegment[]
  selectedVertexIndices: ReadonlySet<number>
  selectedHandles?: ReadonlySet<number>
  showHandles?: ShownHandles
}

export function computeHandleVisibleVertices(
  selectedVertexIndices: ReadonlySet<number>,
  selectedHandles: ReadonlySet<number>,
  segments: readonly VectorSegment[]
): Set<number> {
  // Seed: selected vertices + vertices that own a selected handle
  const seed = new Set(selectedVertexIndices)
  for (const handleId of selectedHandles) {
    const handle = vectorHandleParts(handleId)
    if (!handle || handle.segmentIndex >= segments.length) continue
    const seg = segments[handle.segmentIndex]
    seed.add(handle.tangentField === 'tangentStart' ? seg.start : seg.end)
  }
  // Expand: add only direct neighbors of seed vertices (no cascading)
  const visible = new Set(seed)
  for (const seg of segments) {
    if (seed.has(seg.start)) visible.add(seg.end)
    if (seed.has(seg.end)) visible.add(seg.start)
  }
  return visible
}

/**
 * The points of a path being edited whose handles show and take the pointer: every point when the
 * host asks for all of them, else those near the selection. The canvas and pointer input share it,
 * so a handle that shows is one a press can pick up.
 */
export function handleVisibleVertices(state: HandleVisibilityState): Set<number> {
  if (state.showHandles === 'all') return new Set(state.vertices.keys())
  return computeHandleVisibleVertices(
    state.selectedVertexIndices,
    state.selectedHandles ?? new Set(),
    state.segments
  )
}

/** A handle of a path being edited that shows: whose it is and where its end lies on the page. */
export interface ShownHandle {
  segmentIndex: number
  tangentField: VectorHandleField
  vertexIndex: number
  point: Vector
}

/**
 * The handles of a path being edited that show, in the order the canvas draws them, so the last
 * is on top: each segment's start handle, then its end handle, for points whose handles show
 * (`handleVisibleVertices`) and that have a handle to show. Pointer input picks the topmost.
 */
export function shownHandles(
  state: Omit<HandleVisibilityState, 'vertices'> & { vertices: readonly Vector[] }
): ShownHandle[] {
  const visible = handleVisibleVertices(state)
  const handles: ShownHandle[] = []
  for (const [segmentIndex, segment] of state.segments.entries()) {
    for (const tangentField of ['tangentStart', 'tangentEnd'] as const) {
      const vertexIndex = tangentField === 'tangentStart' ? segment.start : segment.end
      const tangent = segment[tangentField]
      const vertex = state.vertices.at(vertexIndex)
      if (!vertex || !visible.has(vertexIndex) || (tangent.x === 0 && tangent.y === 0)) continue
      handles.push({
        segmentIndex,
        tangentField,
        vertexIndex,
        point: { x: vertex.x + tangent.x, y: vertex.y + tangent.y }
      })
    }
  }
  return handles
}
