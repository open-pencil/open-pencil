import type { VectorNetwork } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { NodeEditOverlayState } from '#core/canvas/node-edit-overlay'
import type { UpdateNodeWithUndo } from '#core/editor/shapes/pen/draw'
import type { VectorHandleField } from '#core/vector/handle-selection'

/**
 * A vector path being edited point by point. Its geometry is page-absolute, mapped through the
 * node's world matrix, so nested, rotated, and flipped vectors edit in place; the canvas draws it
 * through the `NodeEditOverlayState` fields.
 */
export interface NodeEditState extends NodeEditOverlayState {
  origNetwork: VectorNetwork
  origBounds: Rect
  /** Session geometry as entered (page-absolute) — commit is a no-op when unchanged */
  origAbsNetwork: VectorNetwork
  /** Session-local undo/redo stacks of geometry snapshots (Cmd+Z inside edit mode) */
  history: VectorNetwork[]
  future: VectorNetwork[]
  /** Geometry at the last undo/redo restore; divergence invalidates `future` */
  futureBaseline?: VectorNetwork | null
  /** Segments selected as segments, apart from their endpoints, as in Figma */
  selectedSegmentIndices: Set<number>
  draggedHandleInfo: {
    vertexIndex: number
    handleType: VectorHandleField
    segmentIndex: number
  } | null
  selectedHandles: Set<number>
  hoveredHandleInfo: { segmentIndex: number; tangentField: VectorHandleField } | null
  /** The region under the pointer, hatched as in Figma. */
  hoveredRegion: number | null
  /** Regions picked by clicking inside them; their points are selected with them. */
  selectedRegions: Set<number>
}

export interface HandleInfo {
  segmentIndex: number
  tangentField: VectorHandleField
  neighborIndex: number
}

/** The editor actions vector edit mode commits, selects, and deletes through. */
export interface VectorEditActionDeps {
  updateNodeWithUndo: UpdateNodeWithUndo
  select: (ids: string[]) => void
  deleteSelected: () => void
  penCommit: (closed: boolean) => void
}
