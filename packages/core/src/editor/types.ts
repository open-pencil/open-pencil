import type { CanvasKit } from 'canvaskit-wasm'

import type { RulerTheme, SkiaRenderer } from '#core/canvas/renderer'
import type { SceneGraph, VectorSegment, VectorVertex } from '#core/scene-graph'
import type { SnapGuide } from '#core/scene-graph/snap'
import type { UndoManager } from '#core/scene-graph/undo'
import type { TextEditor } from '#core/text/editor'
import type { Color, Rect, Vector } from '#core/types'

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
    oppositeDragTangent: Vector | null
    pendingClose?: boolean
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
  rulerTheme?: RulerTheme
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
