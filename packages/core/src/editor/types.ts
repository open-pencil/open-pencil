import type { Color, Rect, Vector } from '../types'
import type { SceneGraph, VectorSegment, VectorVertex } from '../scene-graph'
import type { SnapGuide } from '../snap'
import type { SkiaRenderer } from '../renderer/renderer'
import type { UndoManager } from '../undo'
import type { TextEditor } from '../text-editor'
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
  v: 'SELECT',
  f: 'FRAME',
  s: 'SECTION',
  r: 'RECTANGLE',
  o: 'ELLIPSE',
  l: 'LINE',
  t: 'TEXT',
  p: 'PEN',
  h: 'HAND'
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
  penState: {
    vertices: VectorVertex[]
    segments: VectorSegment[]
    dragTangent: Vector | null
    closingToFirst: boolean
  } | null
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
