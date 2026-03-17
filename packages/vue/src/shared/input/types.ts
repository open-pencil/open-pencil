import type { NodeType, Rect } from '@open-pencil/core'
import type { Tool } from '@open-pencil/core/editor'

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export type CornerPosition = 'nw' | 'ne' | 'se' | 'sw'

export interface DragDraw {
  type: 'draw'
  startX: number
  startY: number
  nodeId: string
}

export interface DragMove {
  type: 'move'
  startX: number
  startY: number
  originals: Map<string, { x: number; y: number; parentId: string }>
  duplicated?: boolean
  autoLayoutParentId?: string
  brokeFromAutoLayout?: boolean
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
}

export interface DragMarquee {
  type: 'marquee'
  startX: number
  startY: number
}

export interface DragRotate {
  type: 'rotate'
  nodeId: string
  centerX: number
  centerY: number
  startAngle: number
  origRotation: number
}

export interface DragPen {
  type: 'pen-drag'
  startX: number
  startY: number
}

export interface DragTextSelect {
  type: 'text-select'
  startX: number
  startY: number
}

export type DragState =
  | DragDraw
  | DragMove
  | DragPan
  | DragResize
  | DragMarquee
  | DragRotate
  | DragPen
  | DragTextSelect

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
