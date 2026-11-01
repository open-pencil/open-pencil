import type { AttachModifiers, MovePlace, Tool } from '@open-pencil/core'
import type { HandlePosition } from '@open-pencil/core/geometry'
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

import type { FlowDrag } from '#vue/shared/input/flow-reorder'
import type { LayerSizing } from '#vue/shared/input/resize/sizing'

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

/**
 * A connector drawn with the connector tool, from the press to the release or from one click to
 * the next. Positions are screen pixels, to tell a click from a drag.
 */
export interface DragConnectorDraw {
  type: 'connector-draw'
  startSX: number
  startSY: number
  moved: boolean
  /** Where the pointer is, in canvas coordinates. */
  x: number
  y: number
  /** The keys held at the last move, which the release attaches by. */
  modifiers: AttachModifiers
  commit: () => void
  cancel: () => void
}

/** An end of a selected connector dragged to another layer or point. */
export interface DragConnectorEnd {
  type: 'connector-end'
  commit: () => void
  cancel: () => void
}

/** An elbow segment or the curve of a selected connector dragged into place. */
export interface DragConnectorLine {
  type: 'connector-line'
  commit: () => void
  cancel: () => void
}

/** An end of a selected line or arrow dragged to aim it. */
export interface DragLineEnd {
  type: 'line-end'
  commit: () => void
  cancel: () => void
}

/** A sticky note being drawn: it grows from the press corner with the drag, as a frame does. */
export interface DragStickyDraw {
  type: 'sticky-draw'
  /** Grows the note to the pointer, in canvas coordinates. */
  move: (cx: number, cy: number) => void
  commit: () => void
  cancel: () => void
}

/**
 * A sticky note's handle dragged: a corner, top, or bottom scales the whole note, a side switches
 * it between square and wide, as in FigJam.
 */
export interface DragStickyScale {
  type: 'sticky-scale'
  mode: 'scale' | 'wide'
  handle: HandlePosition
  startX: number
  startY: number
  nodeId: string
  origRect: Rect
  /** The note and its sublayers as the drag found them. */
  originals: Map<string, SceneNode>
  /** The scale and top-left the latest step reached. */
  scale: number
  position: Vector
  /** Whether a side drag has reached the wide width. */
  wide: boolean
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
  originals: Map<string, MovePlace>
  duplicated?: boolean
  duplicatedPreviousSelection?: Set<string>
  autoLayoutParentId?: string
  brokeFromAutoLayout?: boolean
  /** The auto layout flows the moved layers are dragged along, as blocks. */
  flows?: FlowDrag[]
  /** Each flow's slot for the block where the drag has reached. */
  flowSlots?: number[]
  /** Space is held: layers keep their parents wherever they are dropped. */
  keepParents?: boolean
  /** Control is held: auto layout frames take the layers as absolute-positioned children. */
  ignoreAutoLayout?: boolean
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
  /** The ratio the layer is locked to, kept unless Control frees it. */
  lockedAspectRatio: number | null
  /** Whether the latest step set the lock aside, so the commit stores the new size. */
  freesLock?: boolean
  appliedRect?: Rect
  /** The layer's edited fields before the drag marked its size, to put back if it changes nothing. */
  origEditedFields?: string[]
  /** The layer's sizing before the drag, taken on its first step. */
  origSizing?: LayerSizing
  /** The sizing the latest step left, which the commit keeps. */
  appliedSizing?: LayerSizing
}

export interface DragMarquee {
  type: 'marquee'
  startX: number
  startY: number
  /** The open frame or section the marquee started in, whose layers it selects. */
  containerId?: string
  /** Whether a press without a drag selects the section it started in: only from no selection. */
  selectsSection: boolean
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

export interface DragPencil {
  type: 'pencil-drag'
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
  /**
   * A selected segment or region that was pressed: releasing without a drag selects only it, or
   * with Shift takes it out of the selection.
   */
  click?: { part: 'segment' | 'region'; index: number; deselect: boolean }
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

/** A drag over empty space while editing a path: selects the points and segments it encloses. */
export interface DragEditMarquee {
  type: 'edit-marquee'
  startX: number
  startY: number
  /** Points kept selected alongside the enclosed ones, as with Shift held. */
  baseSelection: Set<number>
  /** Segments kept selected alongside the enclosed ones, as with Shift held. */
  baseSegments: Set<number>
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
  | DragStickyDraw
  | DragConnectorDraw
  | DragConnectorEnd
  | DragConnectorLine
  | DragLineEnd
  | DragGradient
  | DragMove
  | DragPan
  | DragResize
  | DragStickyScale
  | DragMarquee
  | DragRotate
  | DragPen
  | DragPencil
  | DragTextSelect
  | DragEditNode
  | DragEditHandle
  | DragEditMarquee
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
  TEXT: 'TEXT',
  SHAPE_WITH_TEXT: 'SHAPE_WITH_TEXT'
}
