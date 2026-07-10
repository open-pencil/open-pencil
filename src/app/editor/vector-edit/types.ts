import type { EditorState } from '@open-pencil/core/editor'
import type {
  VectorNetwork,
  VectorRegion,
  VectorSegment,
  VectorVertex
} from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

export type NodeEditState = {
  nodeId: string
  origNetwork: VectorNetwork
  origBounds: Rect
  /** Session geometry as entered (page-absolute) — commit is a no-op when unchanged */
  origAbsNetwork: VectorNetwork
  vertices: VectorVertex[]
  segments: VectorSegment[]
  regions: VectorRegion[]
  /** Session-local undo/redo stacks of geometry snapshots (Cmd+Z inside edit mode) */
  history: VectorNetwork[]
  future: VectorNetwork[]
  /** Geometry at the last undo/redo restore; divergence invalidates `future` */
  futureBaseline?: VectorNetwork | null
  selectedVertexIndices: Set<number>
  draggedHandleInfo: {
    vertexIndex: number
    handleType: 'tangentStart' | 'tangentEnd'
    segmentIndex: number
  } | null
  selectedHandles: Set<string>
  hoveredHandleInfo: {
    segmentIndex: number
    tangentField: 'tangentStart' | 'tangentEnd'
  } | null
}

export type VectorEditState = EditorState & { nodeEditState: NodeEditState | null }

export type HandleInfo = {
  segmentIndex: number
  tangentField: 'tangentStart' | 'tangentEnd'
  neighborIndex: number
}
