import type { Tool } from '@open-pencil/core/editor'
import type {
  DerivedTextGlyph,
  GeometryPath,
  NodeType,
  SceneNode,
  Stroke,
  TextPathData,
  VectorNetwork
} from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'
import type { ResizeSnapshot } from '@open-pencil/scene-graph/resize'

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export type CornerPosition = 'nw' | 'ne' | 'se' | 'sw'

export interface DragDraw {
  type: 'draw'
  /** Start point in the parent's axes. */
  startX: number
  startY: number
  /** Maps a canvas point into the parent's axes. */
  toLocal: (x: number, y: number) => Vector
  /** A line is drawn by its length and angle, as in Figma, not as a box. */
  line?: boolean
  /** Lands a coordinate on the pixel grid while Snap to pixel grid is on. */
  snap: (value: number) => number
  nodeId: string
  update: (changes: Partial<SceneNode>) => void
  commit: () => void
  cancel: () => void
}

export interface DragMove {
  type: 'move'
  startX: number
  startY: number
  currentX: number
  currentY: number
  appliedDx: number
  appliedDy: number
  startScreenX: number
  startScreenY: number
  dragStarted: boolean
  originals: Map<string, { x: number; y: number; parentId: string }>
  duplicated?: boolean
  duplicatedPreviousSelection?: Set<string>
  autoLayoutParentId?: string
  brokeFromAutoLayout?: boolean
  /** Space is held: layers keep their parents wherever they are dropped. */
  keepParents?: boolean
  /** Control is held: auto layout frames take the layers as absolute-positioned children. */
  ignoreAutoLayout?: boolean
  /** Selected instead if the press ends as a click without dragging. */
  selectOnClick?: string
  /** Where Control drops layers among an auto layout frame's children. */
  absoluteInsertIndex?: number
}

export interface DragPan {
  type: 'pan'
  startScreenX: number
  startScreenY: number
  startPanX: number
  startPanY: number
}

export interface DragResize {
  type: 'resize'
  handle: HandlePosition
  startX: number
  startY: number
  origRect: Rect
  nodeId: string
  origVectorNetwork: VectorNetwork | null
  origFillGeometry: GeometryPath[]
  /** Path-text OUTSIDE outlines / vector stroke blobs — must scale with the node. */
  origStrokeGeometry: GeometryPath[]
  origDerivedTextGlyphs: DerivedTextGlyph[] | null
  origStrokes: Stroke[]
  origTextPathData: TextPathData | null
  origTextPathBox: Rect | null
  origChildren: Map<string, ResizeSnapshot> | null
  appliedRect?: Rect
}

export interface DragMarquee {
  type: 'marquee'
  startX: number
  startY: number
  /** The open frame or section the marquee started in, whose layers it selects. */
  containerId?: string
}

export interface DragRotate {
  type: 'rotate'
  nodeId: string
  centerX: number
  centerY: number
  startAngle: number
  origRotation: number
  rotationDirection: 1 | -1
}

export interface DragPen {
  type: 'pen-drag'
  startX: number
  startY: number
  modifierMode: 'default' | 'continuous' | 'independent'
  frozenOppositeTangent: Vector | null
  spaceDown: boolean
  spaceStartX: number
  spaceStartY: number
  knotStartX: number
  knotStartY: number
}

export interface DragTextSelect {
  type: 'text-select'
  startX: number
  startY: number
}

export interface DragEditNode {
  type: 'edit-node'
  startX: number
  startY: number
  origPositions: Map<number, Vector>
}

export interface DragEditHandle {
  type: 'edit-handle'
  segmentIndex: number
  tangentField: 'tangentStart' | 'tangentEnd'
  vertexIndex: number
  startX: number
  startY: number
  initialTangent: Vector | null
}

export interface DragBendHandle {
  type: 'bend-handle'
  vertexIndex: number
  startX: number
  startY: number
  lockedMode: 'symmetric' | 'independent' | null
  dragSamples: Vector[]
  targetSegmentIndex: number | null
  targetTangentField: 'tangentStart' | 'tangentEnd' | null
}

export interface DragGuide {
  type: 'guide'
  axis: 'x' | 'y'
  ownerId: string
  position: number
  startScreenX: number
  startScreenY: number
  currentScreenX: number
  currentScreenY: number
  dragStarted: boolean
  duplicate?: boolean
  guideId?: string
  originalOwnerId?: string
  originalPosition?: number
}

/** Dragging a handle or stop of the gradient whose picker is open. */
export interface DragGradient {
  type: 'gradient'
  /** Moves the dragged handle or stop to a screen point. */
  update: (screenX: number, screenY: number, shiftKey: boolean) => void
  commit: () => void
  cancel: () => void
}

/** Dragging a radius, point count, or ratio handle of the selected rectangle, polygon, or star. */
export interface DragShapeHandle {
  type: 'shape-handle'
  /** Sets the value under a screen point; Shift rounds a radius to tens. */
  update: (screenX: number, screenY: number, shiftKey: boolean) => void
  commit: () => void
  cancel: () => void
}

export type DragState =
  | DragShapeHandle
  | DragDraw
  | DragGradient
  | DragMove
  | DragPan
  | DragResize
  | DragMarquee
  | DragRotate
  | DragPen
  | DragTextSelect
  | DragEditNode
  | DragEditHandle
  | DragBendHandle
  | DragGuide

export const TOOL_TO_NODE: Partial<Record<Tool, NodeType>> = {
  FRAME: 'FRAME',
  SECTION: 'SECTION',
  RECTANGLE: 'RECTANGLE',
  ELLIPSE: 'ELLIPSE',
  LINE: 'LINE',
  POLYGON: 'POLYGON',
  STAR: 'STAR',
  TEXT: 'TEXT'
}
