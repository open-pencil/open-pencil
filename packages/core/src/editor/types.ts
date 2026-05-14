import type { CanvasKit } from 'canvaskit-wasm'

import type { RulerTheme, SkiaRenderer } from '#core/canvas/renderer'
import type { RenderOverlays } from '#core/canvas/renderer/types'
import type { SceneGraph, SceneNode, VectorSegment, VectorVertex } from '#core/scene-graph'
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
    resumingNodeId?: string
    resumedFills?: SceneNode['fills']
    resumedStrokes?: SceneNode['strokes']
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
  autoLayoutHover: {
    nodeId: string
    kind: 'frame' | 'children' | 'spacing' | 'spacing-value' | 'padding' | 'padding-value'
    index?: number
    side?: 'top' | 'right' | 'bottom' | 'left'
  } | null
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
  nodeEditState?: RenderOverlays['nodeEditState'] | null
  cursorCanvasX?: number | null
  cursorCanvasY?: number | null
}

export interface EditorEvents {
  'render:requested': (versions: { renderVersion: number; sceneVersion: number }) => void
  'repaint:requested': (versions: { renderVersion: number; sceneVersion: number }) => void
  'graph:replaced': (graph: SceneGraph) => void
  'node:created': (node: SceneNode) => void
  'node:updated': (id: string, changes: Partial<SceneNode>) => void
  'node:deleted': (id: string) => void
  'node:reparented': (nodeId: string, oldParentId: string | null, newParentId: string) => void
  'node:reordered': (nodeId: string, parentId: string, index: number) => void
  'selection:changed': (selectedIds: string[], previousIds: string[]) => void
  'tool:changed': (tool: Tool, previousTool: Tool) => void
  'page:changed': (pageId: string, previousPageId: string) => void
  'viewport:changed': (
    viewport: { panX: number; panY: number; zoom: number },
    previous: { panX: number; panY: number; zoom: number }
  ) => void
}

export type EditorEventName = keyof EditorEvents

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
  emitEditorEvent: <K extends EditorEventName>(
    event: K,
    ...args: Parameters<EditorEvents[K]>
  ) => void
  setSelectedIds: (ids: Set<string>) => void
  setActiveTool: (tool: Tool) => void
  runLayoutForNode: (id: string) => void
  subscribeToGraph: () => void
}
