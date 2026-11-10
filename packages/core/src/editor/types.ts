import type { CanvasKit } from '@open-pencil/canvaskit'
import type {
  DocumentColorSpace,
  DocumentKind,
  SceneGraph,
  SceneGraphEvents,
  SceneNode,
  VectorNetwork,
  VectorSegment,
  VectorVertex
} from '@open-pencil/scene-graph'
import type { CanvasGuide } from '@open-pencil/scene-graph/guides'
import type { Color, Rect, Vector } from '@open-pencil/scene-graph/primitives'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'
import type { HistoryChange, UndoEntry, UndoManager } from '@open-pencil/scene-graph/undo'

import type { GuideOverlayState } from '#core/canvas/guides/types'
import type { DesignIssueOverlay } from '#core/canvas/issues/types'
import type { RulerTheme, SkiaRenderer } from '#core/canvas/renderer'
import type { MeasurementMode, PresenceCursor, SelectionTheme } from '#core/canvas/renderer/types'
import type { InterfaceTheme } from '#core/constants'
import type { ConnectorTarget } from '#core/editor/connectors/attach'
import type { DecidedMove } from '#core/editor/move-policy'
import type { SnappingPreferences } from '#core/editor/preferences'
import type { ShaderRasterizer } from '#core/editor/shaders/types'
import type { PenPressEvent, PenReleaseEvent } from '#core/editor/shapes/pen/gesture'
import type { NodeEditState } from '#core/editor/vector/types'
import type { ViewportInsets } from '#core/editor/viewport'
import type { CanvasView, EditorRestrictions } from '#core/editor/views/types'
import type { RotationPreview, ShapeHandleKind } from '#core/geometry'
import type { IconProvider } from '#core/icons/provider'
import type { MutationWithLayout } from '#core/layout/mutations'
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
  | 'STICKY'
  | 'SHAPE_WITH_TEXT'
  | 'CONNECTOR'
  | 'PEN'
  | 'PENCIL'
  | 'HAND'
  | 'COMMENT'
  | 'EYEDROPPER'

/** The gradient whose handles the canvas shows while its paint picker is open. */
export interface GradientEdit {
  nodeId: string
  paint: 'fills' | 'strokes'
  index: number
  /** The selected stop, shared by the canvas handles and the picker. */
  stop: number
}

/** The progressive blur whose start and end handles the canvas shows while its settings are open. */
export interface BlurRampEdit {
  nodeId: string
  /** The blur's place in the layer's effects. */
  index: number
}

/** The selected shape's radius, point count, and ratio handles, shown while the pointer is over it. */
export interface ShapeHandleHover {
  nodeId: string
  /** Whether a drag changes only the corner it holds; each handle then shows a dot. */
  single: boolean
  /** The handle under the pointer or being dragged, whose value the label shows. */
  handle: ShapeHandleKind | null
  /** The handle's name in the label, in the interface language. */
  label: string
  /** The pointer in screen coordinates, which the label follows. */
  pointer: Vector
}

export interface EditorSharedState {
  activeTool: Tool
  /** The kind the shape-with-text tool places: the one picked last, as in FigJam. */
  shapeWithTextKind: ShapeWithTextType
  /**
   * What the host takes away from every canvas, such as editing for a viewer or an earlier version;
   * read through `resolveEditorProfile`, set with `setReadOnly`.
   */
  /** What the open document is for, as its graph records it; set with `setDocumentKind`. */
  documentKind: DocumentKind
  hostRestrictions: EditorRestrictions
  snappingPreferences: SnappingPreferences
  /** Draw the pixel grid once zoomed in far enough, as Figma's View › Pixel grid; shown unless false. */
  showPixelGrid?: boolean
  /** Draw the selection's width × height under it, as Figma does; shown unless false. */
  showSizeLabels?: boolean
  /** The gradient being edited, whose handles the canvas draws and drags. */
  gradientEdit?: GradientEdit | null
  /** The progressive blur being edited, whose start and end the canvas draws and drags. */
  blurRampEdit?: BlurRampEdit | null
  presenceCursors: PresenceCursor[]
  documentName: string
  /** Design check markers and highlight, shared by every canvas pane. */
  designIssues: DesignIssueOverlay | null
  /** The layer of the code element around the cursor in a code editor, shown in every pane. */
  codeFocusNodeId: string | null
  rulerTheme?: RulerTheme
  /** Selection chrome on the canvas, following the interface accent; the default blue when unset. */
  selectionTheme?: SelectionTheme
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

/**
 * The path a pen continues, in page coordinates, and where the pen's chain sits in it. The pen
 * walks one chain out of the network; committing writes the chain back and keeps the rest.
 */
export interface ResumedPath {
  network: VectorNetwork
  /** Each chain vertex's index in `network`. */
  vertices: number[]
  /** Each chain segment's index in `network`, and whether the chain runs it from end to start. */
  segments: Array<{ index: number; reversed: boolean }>
}

export interface PencilState {
  points: Vector[]
  /** The point Shift was pressed at; the stroke runs straight from it while Shift is held. */
  straightFrom: number | null
  /** How the stroke shows while it is drawn. */
  preview: { color: Color; weight: number }
}

export interface EditorViewState {
  currentPageId: string
  selectedIds: Set<string>
  marquee: Rect | null
  snapGuides: SnapGuide[]
  /**
   * Points the host adds to what the pen and vector edit mode snap to, on the current page
   * (`setSnapTargets`), such as where a traced shape starts and ends.
   */
  snapTargets: { points: Vector[] }
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
  /** The layer whose name a field over the canvas renames; the canvas leaves its title to the field. */
  renamingLabelId: string | null
  penState: {
    vertices: VectorVertex[]
    segments: VectorSegment[]
    dragTangent: Vector | null
    oppositeDragTangent: Vector | null
    pendingClose?: boolean
    /**
     * The last point's outgoing handle while the pen closes the path: the closing segment starts
     * with it, and `dragTangent` holds the drag at the first point.
     */
    closeTangent?: Vector | null
    closingToFirst: boolean
    resumingNodeId?: string
    resumedPath?: ResumedPath
    resumedFills?: SceneNode['fills']
    resumedStrokes?: SceneNode['strokes']
  } | null
  penCursorX: number | null
  penCursorY: number | null
  /** The freehand stroke being drawn with the pencil, in canvas coordinates. */
  pencilState: PencilState | null
  autoLayoutHover: {
    nodeId: string
    kind: 'frame' | 'children' | 'spacing' | 'spacing-value' | 'padding' | 'padding-value'
    index?: number
    side?: 'top' | 'right' | 'bottom' | 'left'
  } | null
  shapeHandleHover: ShapeHandleHover | null
  /** The layer a connector end being drawn or dragged would attach to, and by which magnet. */
  connectorTarget: ConnectorTarget | null
  panX: number
  pageColor: Color
  panY: number
  zoom: number
  navigation: NavigationState
  renderVersion: number
  /** Bumped when the caret or selection of the text being edited moves, which changes nothing else. */
  textSelectionVersion: number
  enteredContainerId: string | null
  /** The vector path being edited point by point, or null outside vector edit mode. */
  nodeEditState: NodeEditState | null
  cursorCanvasX?: number | null
  cursorCanvasY?: number | null
  /** What this canvas shows: the design being edited, or running as a preview. */
  canvasView: CanvasView
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

/**
 * What a frame draws: `sceneVersion` counts the document's content, `renderVersion` everything
 * on screen, the viewport included.
 */
export interface RenderVersions {
  renderVersion: number
  sceneVersion: number
}

export interface EditorEvents extends SceneGraphEvents {
  'render:requested': (versions: RenderVersions) => void
  'repaint:requested': (versions: RenderVersions) => void
  /**
   * A canvas drawing the editor's own state showed a frame of these versions with the whole
   * visible scene on screen, nothing left to fill in. Overlay-only canvases and split panes
   * showing another view do not report.
   */
  'render:presented': (versions: RenderVersions) => void
  'graph:replaced': (graph: SceneGraph) => void
  'document:color-space-changed': (colorSpace: DocumentColorSpace) => void
  'document:libraries-changed': () => void
  'document:read-only-changed': (readOnly: boolean) => void
  /** The host's restrictions changed (`setHostRestrictions`); read them from the profile. */
  'document:restrictions-changed': () => void
  'document:kind-changed': (kind: DocumentKind) => void
  /**
   * Committed history changed: a new step was recorded, with the step; a change joined it
   * (`'join'`); or undo, redo, or clearing ran. A host that responds to the person's edits
   * responds to `'record'`, joining its response to the step (`recordEdit`'s `joinStep`); undo and
   * redo bring back a document that was already responded to.
   */
  'history:changed': (change: HistoryChange, step?: UndoEntry) => void
  /**
   * An edit or batch ended without a step, rolled back or changing nothing, so what it changed
   * meanwhile is undone. The history is unchanged.
   */
  'edit:discarded': () => void
  /** A press of the pen, before it acts; `cancelGesture` refuses it. */
  'pen:pressed': (event: PenPressEvent) => void
  /** The release ending a press of the pen, before it commits; `cancelGesture` takes it back. */
  'pen:released': (event: PenReleaseEvent) => void
  /** The gesture in progress was taken back (`cancelGesture`); the canvas drops what it holds. */
  'gesture:cancelled': () => void
  'selection:changed': (selectedIds: string[], previousIds: string[]) => void
  'rotation:preview-changed': (preview: RotationPreview | null) => void
  'tool:changed': (tool: Tool, previousTool: Tool) => void
  'page:changed': (pageId: string, previousPageId: string) => void
  'guides:changed': (ownerId: string, guides: readonly CanvasGuide[]) => void
  'clipboard:images-missing': (resolution: ClipboardImageResolution) => void
  'font:resolution-changed': (event: FontResolutionEvent, snapshot: FontResolutionSnapshot) => void
  /** A font face finished loading, however it was asked for. */
  'font:loaded': (family: string, style: string) => void
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
  /**
   * The canvas's size in screen pixels. Without it the editor uses the size the canvas last gave
   * `setViewportSize`, and the window's before that.
   */
  getViewportSize?: () => { width: number; height: number }
  /** The name of whoever is editing, which a sticky note they place is signed with. */
  getUserName?: () => string
  /** Where icons are searched and fetched; defaults to Iconify. */
  icons?: IconProvider
  /** What draws shader frames, which needs a GPU; without one, saved frames stay. */
  shaderRasterizer?: ShaderRasterizer | null
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
  /** Screen pixels of floating UI over each canvas edge, which fitted layers keep clear of. */
  getViewportChrome: () => ViewportInsets
  getUserName: () => string
  icons: IconProvider
  getCk: () => CanvasKit | null
  getRenderer: () => SkiaRenderer | null
  /** Every canvas drawing the document, such as each pane's scene and overlays. */
  getRenderers: () => Iterable<SkiaRenderer>
  getTextEditor: () => TextEditor | null
  requestRender: () => void
  /** A change to a layer with its position as the host's move policy decides it (`setMovePolicy`). */
  constrainMove: <T extends Partial<SceneNode>>(
    node: SceneNode,
    changes: T,
    preview?: boolean
  ) => DecidedMove<T>
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
    fallbackId?: string
  ) => Promise<MutationWithLayout<T>>
  subscribeToGraph: () => void
}
