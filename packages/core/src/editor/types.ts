import type { SkiaRenderer } from '../renderer/renderer'
import type {
  Fill,
  SceneGraph,
  SceneNode,
  VectorNetwork,
  VectorRegion,
  VectorSegment,
  VectorVertex
} from '../scene-graph'
import type { SnapGuide } from '../snap'
import type { TextEditor } from '../text-editor'
import type { Color, Rect, Vector } from '../types'
import type { UndoManager } from '../undo'
import type { CanvasKit } from 'canvaskit-wasm'

export type Tool =
  | 'SELECT'
  | 'FRAME'
  | 'SECTION'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'LINE'
  | 'POLYGON'
  | 'STAR'
  | 'TEXT'
  | 'PEN'
  | 'HAND'

export interface EditorToolDef {
  key: Tool
  label: string
  shortcut: string
  flyout?: Tool[]
}

export const EDITOR_TOOLS: EditorToolDef[] = [
  { key: 'SELECT', label: 'Move', shortcut: 'V' },
  { key: 'FRAME', label: 'Frame', shortcut: 'F', flyout: ['FRAME', 'SECTION'] },
  {
    key: 'RECTANGLE',
    label: 'Rectangle',
    shortcut: 'R',
    flyout: ['RECTANGLE', 'LINE', 'ELLIPSE', 'POLYGON', 'STAR']
  },
  { key: 'PEN', label: 'Pen', shortcut: 'P' },
  { key: 'TEXT', label: 'Text', shortcut: 'T' },
  { key: 'HAND', label: 'Hand', shortcut: 'H' }
]

export const TOOL_SHORTCUTS: Partial<Record<string, Tool>> = {
  KeyV: 'SELECT',
  KeyF: 'FRAME',
  KeyS: 'SECTION',
  KeyR: 'RECTANGLE',
  KeyO: 'ELLIPSE',
  KeyL: 'LINE',
  KeyT: 'TEXT',
  KeyP: 'PEN',
  KeyH: 'HAND'
}

export type HandleField = 'tangentStart' | 'tangentEnd'

export interface HandleRef {
  segmentIndex: number
  tangentField: HandleField
}

export interface NodeEditState {
  nodeId: string
  origNetwork: VectorNetwork
  origBounds: Rect
  vertices: VectorVertex[]
  segments: VectorSegment[]
  regions: VectorRegion[]
  selectedVertexIndices: Set<number>
  draggedHandleInfo: {
    vertexIndex: number
    handleType: HandleField
    segmentIndex: number
  } | null
  selectedHandles: Set<string>
  hoveredHandleInfo: HandleRef | null
}

export interface PenState {
  vertices: VectorVertex[]
  segments: VectorSegment[]
  dragTangent: Vector | null
  oppositeDragTangent: Vector | null
  pendingClose?: boolean
  closingToFirst: boolean
  resumingNodeId?: string
  resumedFills?: Fill[]
  resumedStrokes?: SceneNode['strokes']
}

export interface EditorState {
  activeTool: Tool
  currentPageId: string
  selectedIds: Set<string>
  marquee: Rect | null
  snapGuides: SnapGuide[]
  rotationPreview: { nodeId: string; angle: number } | null
  dropTargetId: string | null
  layoutInsertIndicator: {
    parentId: string
    index: number
    x: number
    y: number
    length: number
    direction: 'HORIZONTAL' | 'VERTICAL'
  } | null
  hoveredNodeId: string | null
  editingTextId: string | null
  penState: PenState | null
  nodeEditState: NodeEditState | null
  penCursorX: number | null
  penCursorY: number | null
  remoteCursors: Array<{
    name: string
    color: Color
    x: number
    y: number
    selection?: string[]
  }>
  documentName: string
  panX: number
  pageColor: Color
  panY: number
  zoom: number
  renderVersion: number
  sceneVersion: number
  loading: boolean
  enteredContainerId: string | null
}

export interface EditorOptions {
  graph?: SceneGraph
  state?: EditorState
  loadFont?: (family: string, style: string) => Promise<ArrayBuffer | null>
  getViewportSize?: () => { width: number; height: number }
  skipInitialGraphSetup?: boolean
}

export interface EditorContext {
  get graph(): SceneGraph
  set graph(g: SceneGraph)
  undo: UndoManager
  state: EditorState
  loadFont: (family: string, style: string) => Promise<ArrayBuffer | null>
  getViewportSize: () => { width: number; height: number }
  getCk: () => CanvasKit | null
  getRenderer: () => SkiaRenderer | null
  getTextEditor: () => TextEditor | null
  requestRender: () => void
  requestRepaint: () => void
  runLayoutForNode: (id: string) => void
  subscribeToGraph: () => void
}
