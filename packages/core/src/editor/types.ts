import type { CanvasKit } from 'canvaskit-wasm'

import type {
  DocumentColorSpace,
  SceneGraph,
  SceneGraphEvents,
  SceneNode,
  VectorSegment,
  VectorVertex
} from '@open-pencil/scene-graph'
import type { CanvasGuide } from '@open-pencil/scene-graph/guides'
import type { Color, Rect, Vector } from '@open-pencil/scene-graph/primitives'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'
import type { UndoManager } from '@open-pencil/scene-graph/undo'

import type { GuideOverlayState } from '#core/canvas/guides/types'
import type { DesignIssueOverlay } from '#core/canvas/issues/types'
import type { RulerTheme, SkiaRenderer } from '#core/canvas/renderer'
import type { MeasurementMode, PresenceCursor, RenderOverlays } from '#core/canvas/renderer/types'
import type { InterfaceTheme } from '#core/constants'
import type { PlayState } from '#core/editor/play/actions'
import type { SnappingPreferences } from '#core/editor/preferences'
import type { RotationPreview } from '#core/geometry'
import type { IconProvider } from '#core/icons/provider'
import type { TextEditor } from '#core/text/editor'
import type { FontResolutionEvent, FontResolutionSnapshot } from '#core/text/resolver'

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

/** The gradient whose handles the canvas shows while its paint picker is open. */
export interface GradientEdit {
  nodeId: string
  paint: 'fills' | 'strokes'
  index: number
  /** The selected stop, shared by the canvas handles and the picker. */
  stop: number
}

export interface EditorSharedState {
  activeTool: Tool
  snappingPreferences: SnappingPreferences
  /** Draw the pixel grid once zoomed in far enough, as Figma's View › Pixel grid; shown unless false. */
  showPixelGrid?: boolean
  /** The gradient being edited, whose handles the canvas draws and drags. */
  gradientEdit?: GradientEdit | null
  presenceCursors: PresenceCursor[]
  documentName: string
  /** Design check markers and highlight, shared by every canvas pane. */
  designIssues: DesignIssueOverlay | null
  /** The layer of the code element around the cursor in a code editor, shown in every pane. */
  codeFocusNodeId: string | null
  rulerTheme?: RulerTheme
  /** The interface theme new sections take their fill from; light when unset. */
  theme?: InterfaceTheme
  /** Bumped by every document change; views, saving, and recovery follow it. */
  sceneVersion: number
  /**
   * Bumped by document changes the canvas draws. Changes it does not draw, such as a variable's
   * name or CSS name, bump only `sceneVersion`, so the canvas keeps its recorded pictures.
   */
  canvasVersion: number
}

export interface EditorViewState {
  currentPageId: string
  selectedIds: Set<string>
  marquee: Rect | null
  snapGuides: SnapGuide[]
  guides: GuideOverlayState
  rotationPreview: RotationPreview | null
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
  /** A pointer move, resize, or rotation is in progress. */
  transforming: boolean
  measurementMode: MeasurementMode
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
  autoLayoutHover: {
    nodeId: string
    kind: 'frame' | 'children' | 'spacing' | 'spacing-value' | 'padding' | 'padding-value'
    index?: number
    side?: 'top' | 'right' | 'bottom' | 'left'
  } | null
  panX: number
  pageColor: Color
  panY: number
  zoom: number
  navigation: NavigationState
  renderVersion: number
  enteredContainerId: string | null
  nodeEditState?: RenderOverlays['nodeEditState'] | null
  cursorCanvasX?: number | null
  cursorCanvasY?: number | null
  /** This canvas's preview, or null while it edits. */
  play: PlayState | null
}

export type NavigationPhase = 'idle' | 'pan' | 'zoom' | 'momentum' | 'settling'

export interface NavigationState {
  phase: NavigationPhase
  generation: number
  lastInputAt: number
}

export interface EditorState extends EditorSharedState, EditorViewState {}

export interface ClipboardImageResolution {
  total: number
  missing: number
  fetchAttempted: boolean
}

export type FigmaClipboardImageResolver = (
  fileKey: string,
  hashes: string[]
) => Promise<ReadonlyMap<string, Uint8Array>>

export interface EditorEvents extends SceneGraphEvents {
  'render:requested': (versions: { renderVersion: number; sceneVersion: number }) => void
  'repaint:requested': (versions: { renderVersion: number; sceneVersion: number }) => void
  'graph:replaced': (graph: SceneGraph) => void
  'document:color-space-changed': (colorSpace: DocumentColorSpace) => void
  'history:changed': () => void
  'selection:changed': (selectedIds: string[], previousIds: string[]) => void
  'rotation:preview-changed': (preview: RotationPreview | null) => void
  'tool:changed': (tool: Tool, previousTool: Tool) => void
  'page:changed': (pageId: string, previousPageId: string) => void
  'guides:changed': (ownerId: string, guides: readonly CanvasGuide[]) => void
  'clipboard:images-missing': (resolution: ClipboardImageResolution) => void
  'font:resolution-changed': (event: FontResolutionEvent, snapshot: FontResolutionSnapshot) => void
  'viewport:changed': (
    viewport: { panX: number; panY: number; zoom: number },
    previous: { panX: number; panY: number; zoom: number }
  ) => void
  'navigation:changed': (navigation: NavigationState, previous: NavigationState) => void
}

export type EditorEventName = keyof EditorEvents

export interface EditorOptions {
  graph?: SceneGraph
  state?: EditorState
  loadFont?: (
    family: string,
    style: string,
    characters?: string,
    signal?: AbortSignal
  ) => Promise<ArrayBuffer | null>
  resolveFigmaClipboardImages?: FigmaClipboardImageResolver
  getViewportSize?: () => { width: number; height: number }
  /** Where icons are searched and fetched; defaults to Iconify. */
  icons?: IconProvider
  skipInitialGraphSetup?: boolean
}

export interface EditorContext {
  get graph(): SceneGraph
  set graph(g: SceneGraph)
  undo: UndoManager
  state: EditorState
  loadFont: (
    family: string,
    style: string,
    characters?: string,
    signal?: AbortSignal
  ) => Promise<ArrayBuffer | null>
  resolveFigmaClipboardImages: FigmaClipboardImageResolver | null
  getViewportSize: () => { width: number; height: number }
  icons: IconProvider
  getCk: () => CanvasKit | null
  getRenderer: () => SkiaRenderer | null
  getTextEditor: () => TextEditor | null
  requestRender: () => void
  /** A document change the canvas does not draw: views and saving follow, nothing is redrawn. */
  requestRefresh: () => void
  requestRepaint: () => void
  beginInteractiveEdit: () => () => void
  onEditorEvent: <K extends EditorEventName>(event: K, handler: EditorEvents[K]) => () => void
  emitEditorEvent: <K extends EditorEventName>(
    event: K,
    ...args: Parameters<EditorEvents[K]>
  ) => void
  setSelectedIds: (ids: Set<string>) => void
  setActiveTool: (tool: Tool) => void
  setNavigationPhase: (phase: NavigationPhase, inputAt?: number) => void
  runLayoutForNode: (id: string) => void
  runMutationWithLayout: <T>(
    operation: () => T | Promise<T>,
    fallbackId?: string,
    beforeLayout?: (result: T) => Promise<void> | void
  ) => Promise<T>
  subscribeToGraph: () => void
}
