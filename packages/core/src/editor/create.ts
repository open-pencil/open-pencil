import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { UndoManager } from '@open-pencil/scene-graph/undo'

import { prefetchFigmaSchema } from '#core/clipboard'
import { IS_BROWSER } from '#core/constants'
import {
  getPageColor,
  hasStoredBackground,
  setDefaultPageBackground
} from '#core/figma-api/page-backgrounds'
import { defaultIcons } from '#core/icons'
import { releaseFigPopulationWorker } from '#core/kiwi/fig/population/client'
import { releaseOriginalFigArchive } from '#core/kiwi/fig/session/original-archive'
import { createLayoutRunner } from '#core/layout/mutations'
import { fontManager } from '#core/text/font/manager'
import { prepareTextFonts } from '#core/text/prepare'
import { fontResolver } from '#core/text/resolver'

import { createAlignmentActions } from './alignment'
import { createClipboardBridge } from './bridges/clipboard'
import { createComponentBridge } from './bridges/components'
import { createFrameNavigationBridge } from './bridges/frames'
import { createLintFixBridge } from './bridges/lint'
import { createStructureBridge } from './bridges/structure'
import { createUndoBridge } from './bridges/undo'
import { createClipboardActions } from './clipboard'
import { createClipboardPropertiesActions } from './clipboard/paste/properties'
import { createColorSpaceActions } from './color-space'
import { createComponentActions } from './components'
import { createComponentSyncScheduler } from './components/sync'
import { createConnectorDrawActions, createConnectorEndpointActions } from './connectors/draw'
import { createConnectorLineActions } from './connectors/line'
import { createConnectorRouting } from './connectors/routing'
import { createConnectorStyleActions } from './connectors/style'
import { createDesignTokenActions } from './design-tokens'
import { createDocumentSettingsActions } from './document-settings'
import { createFigCompressionActions } from './fig-compression'
import { createFigJamColorActions } from './figjam/colors'
import { createGraphEventSubscription } from './graph-events'
import { createGraphReadActions } from './graph-reads'
import { createGuideActions } from './guides'
import { createIconActions } from './icons'
import { createDesignIssueActions } from './issues'
import { createLineEndActions } from './line-ends'
import { createMovePolicy } from './move-policy'
import { createNodeActions } from './nodes/actions'
import { createPageActions } from './pages'
import { createReadOnlyActions, guardEdits, guardUndo } from './read-only'
import { createCanvasRenderers } from './renderers'
import { createSelectionActions } from './selection'
import { createShaderActions } from './shaders/actions'
import { createShaderFrames } from './shaders/frames'
import { createShapeActions } from './shapes'
import { createPenResumeActions } from './shapes/pen/resume'
import { createShapeWithTextActions } from './shapes/with-text'
import { createEditorSignals } from './signals'
import { createDefaultEditorState } from './state'
import { createStatusActions } from './statuses'
import { createStickyActions } from './stickies'
import { createStructureActions } from './structure'
import { createTextActions } from './text'
import { createPendingTextLayout } from './text/pending-layout'
import { createTextSelectionStyle } from './text/selection-style'
import { createFigJamTextActions } from './text/typeface'
import type { EditorContext, EditorOptions, EditorState, Tool } from './types'
import { createUndoActions } from './undo'
import { createVariableActions } from './variables/actions'
import { createVectorEditActions } from './vector/create'
import { createVectorizeActions } from './vectorize'
import { createViewportActions } from './viewport'
import { createViewportSize } from './viewport/size'
import { createCanvasViewActions, offeredTool } from './views'

export { createDefaultEditorState } from './state'

export function createEditor(options?: EditorOptions) {
  let _graph = options?.graph ?? new SceneGraph()
  const skipInitialGraphSetup = options?.skipInitialGraphSetup ?? false
  const state: EditorState = options?.state ?? createDefaultEditorState(_graph.getPages()[0].id)
  state.documentKind = _graph.documentKind
  state.activeTool = offeredTool(state, state.activeTool)
  const signals = createEditorSignals(state)
  const {
    emitEditorEvent,
    onEditorEvent,
    requestRender,
    requestRefresh,
    requestRepaint,
    beginInteractiveEdit,
    setNavigationPhase,
    setSelectedIds,
    setActiveTool
  } = signals
  const undo = new UndoManager({
    onChange: (change, step) => emitEditorEvent('history:changed', change, step),
    onDiscard: () => emitEditorEvent('edit:discarded'),
    runReplay: (replay) => _graph.runOutsideEdits(replay)
  })
  const _loadFont = options?.loadFont ?? fontManager.loadFont.bind(fontManager)
  const { currentViewportChrome, ...viewportSize } = createViewportSize(
    options?.getViewportSize,
    () => (IS_BROWSER ? { width: window.innerWidth, height: window.innerHeight } : null)
  )
  const canvas = createCanvasRenderers(
    (renderer, node, maxWidth) => pendingTextLayout.measure(renderer, node, maxWidth),
    // A page shown before this editor had a canvas to measure its text, as one a tab opens while
    // its canvas loads, is laid out now that one can.
    () => pages.layOutStaleCurrentPage()
  )
  const _renderers = canvas.renderers
  const stopFontResolutionEvents = fontResolver.subscribe((event, snapshot) =>
    emitEditorEvent('font:resolution-changed', event, snapshot)
  )
  const stopFontLoadEvents = fontManager.onFaceLoaded((family, style) =>
    emitEditorEvent('font:loaded', family, style)
  )
  // Text blocked while its fonts were prepared is missing from the tiles drawn meanwhile.
  const stopUnblockEvents = fontManager.onNodesUnblocked((graph, nodeIds) => {
    if (graph !== _graph) return
    for (const renderer of _renderers) for (const id of nodeIds) renderer.redrawNode(id, graph)
    requestRender()
  })

  void prefetchFigmaSchema()

  const graphReads = createGraphReadActions(() => _graph)
  const { runLayoutForNode, runMutationWithLayout } = createLayoutRunner(() => _graph)
  const pendingTextLayout = createPendingTextLayout({
    getGraph: () => _graph,
    getRenderer: canvas.getRenderer,
    prepareFonts: (texts) => prepareTextFonts(texts, { loadFont: _loadFont }),
    runLayoutForNode,
    requestRender,
    onEditorEvent
  })
  const { scheduleComponentSync, flushComponentSync, isSyncingComponents } =
    createComponentSyncScheduler(() => _graph, requestRender)

  const { subscribeToGraph, unsubscribeFromGraph } = createGraphEventSubscription({
    getGraph: () => _graph,
    getRenderers: () => _renderers,
    scheduleComponentSync,
    requestRender,
    emitEditorEvent
  })

  if (!skipInitialGraphSetup) {
    subscribeToGraph()
    // A new document's first page takes Figma's background for the interface theme the app gives;
    // a page that already has one keeps it.
    const firstPage = _graph.getPages()[0]
    if (options?.state?.theme && !hasStoredBackground(firstPage)) {
      setDefaultPageBackground(_graph, firstPage, options.state.theme)
      options.state.pageColor = getPageColor(firstPage)
    }
  }

  // Build the shared context
  const movePolicy = createMovePolicy(undo)
  const ctx: EditorContext = {
    get graph() {
      return _graph
    },
    set graph(g) {
      _graph = g
    },
    undo,
    state,
    loadFont: _loadFont,
    resolveFigmaClipboardImages: options?.resolveFigmaClipboardImages ?? null,
    getViewportSize: viewportSize.getViewportSize,
    getViewportChrome: currentViewportChrome,
    getUserName: () => options?.getUserName?.() ?? '',
    icons: options?.icons ?? defaultIcons,
    getCk: canvas.getCk,
    getRenderer: canvas.getRenderer,
    getRenderers: () => _renderers,
    getTextEditor: canvas.getTextEditor,
    requestRender,
    constrainMove: movePolicy.constrainMove,
    requestRefresh,
    requestRepaint,
    beginInteractiveEdit,
    onEditorEvent,
    emitEditorEvent,
    setSelectedIds,
    setActiveTool,
    setNavigationPhase,
    runLayoutForNode,
    runMutationWithLayout,
    subscribeToGraph
  }

  // Assemble domain modules
  const viewport = createViewportActions(ctx)
  const selection = createSelectionActions(ctx)
  const shaderFrames = createShaderFrames(ctx, options)
  const pages = createPageActions(ctx, shaderFrames)
  const guides = createGuideActions(ctx)
  const designIssues = createDesignIssueActions(ctx)
  const structure = createStructureActions(ctx)
  const components = createComponentActions(ctx)
  const clipboard = createClipboardActions(ctx)
  const colorSpace = createColorSpaceActions(ctx)
  const documentSettings = createDocumentSettingsActions(ctx)
  const undoActions = createUndoActions(ctx)
  const text = createTextActions(ctx)
  const nodes = createNodeActions(ctx)
  const shapes = createShapeActions(ctx, nodes.updateNodeWithUndo)
  const clipboardProperties = createClipboardPropertiesActions(
    ctx,
    nodes.updateNodeWithUndo,
    clipboard.loadFontsForNodes
  )
  const variables = createVariableActions(ctx)
  const designTokens = createDesignTokenActions(ctx, variables, nodes)
  const vectorize = createVectorizeActions(ctx)
  const icons = createIconActions(ctx)
  const stickies = createStickyActions(ctx, nodes)
  const shapesWithText = createShapeWithTextActions(ctx, nodes)
  const figJamText = createFigJamTextActions(ctx, nodes, { ...stickies, ...shapesWithText })
  const figJamColors = createFigJamColorActions(ctx, nodes)
  const statuses = createStatusActions(ctx)
  const figCompression = createFigCompressionActions(ctx)
  createConnectorRouting(ctx)
  const connectorDrawing = createConnectorDrawActions(ctx)
  const connectorEndpoints = createConnectorEndpointActions(
    ctx,
    nodes.beginNodePreview,
    clipboard.deleteNodes
  )
  const connectorLines = createConnectorLineActions(ctx, nodes.beginNodePreview)
  const connectorStyles = createConnectorStyleActions(ctx, nodes)
  const lineEnds = createLineEndActions(ctx, nodes.beginNodePreview)
  const shaders = createShaderActions(ctx, nodes)
  const alignment = createAlignmentActions(ctx)
  const canvasViews = createCanvasViewActions(ctx)
  const clipboardBridge = createClipboardBridge(clipboard, selection)
  const componentBridge = createComponentBridge(components, selection, structure, pages)
  const structureBridge = createStructureBridge(structure, selection)
  const frameNavigation = createFrameNavigationBridge(ctx, selection, viewport)
  const undoBridge = createUndoBridge(undoActions, selection, nodes.flushNudge)
  const lintFixBridge = createLintFixBridge(ctx, nodes, structure, clipboard)
  const textSelectionStyle = createTextSelectionStyle(ctx, text.runTextEditStep)
  const vectorEdit = createVectorEditActions(ctx, {
    updateNodeWithUndo: nodes.updateNodeWithUndo,
    select: selection.select,
    deleteSelected: clipboard.deleteSelected,
    penCommit: shapes.penCommit
  })
  const { cancelPenGesture, ...shapeActions } = shapes
  const { cancelNodeEditChange, ...vectorEditActions } = vectorEdit
  /**
   * Takes back the gesture in progress, such as a press of the pen or a drag in vector edit mode,
   * leaving no undo step or redo, and tells the canvas to drop it (`gesture:cancelled`). A host
   * refuses what the person is doing so, from the gesture's own events, such as `pen:pressed`.
   */
  function cancelGesture() {
    if (!cancelPenGesture()) cancelNodeEditChange()
    emitEditorEvent('gesture:cancelled')
  }
  const penResume = createPenResumeActions(ctx, {
    penCommit: shapes.penCommit,
    penPushHistory: shapes.penPushHistory,
    exitNodeEditMode: vectorEdit.exitNodeEditMode
  })
  function endLayerEdits() {
    nodes.flushNudge()
    nodes.cancelNodePreviews()
    if (state.editingTextId) text.commitTextEdit()
  }
  const readOnly = createReadOnlyActions(ctx, movePolicy, {
    endLayerEdits,
    flushPendingStep: nodes.flushNudge,
    endEdits: () => {
      endLayerEdits()
      vectorEdit.exitNodeEditMode(true, { release: true })
      shapes.penCancel()
      shapes.pencilCancel()
      state.gradientEdit = null
      state.blurRampEdit = null
    },
    endPathContinuation: () => {
      if (state.penState?.resumingNodeId) shapes.penCommit(false)
    },
    pickTool: shapes.setTool
  })

  // The edited text follows changes made outside the editor, such as a panel field being
  // dragged, so its caret and selection move with the text instead of after the change.
  const invalidateEditedText = (id: string) => {
    if (id !== state.editingTextId) return
    const node = _graph.getNode(id)
    if (node) canvas.getTextEditor()?.invalidateParagraph(node)
  }
  onEditorEvent('node:updated', invalidateEditedText)
  onEditorEvent('node:previewUpdated', invalidateEditedText)

  function replaceGraph(newGraph: SceneGraph) {
    nodes.cancelNodePreviews()
    // A pen path belongs to the document it was drawn in.
    if (state.penState) shapes.penCancel()
    undo.discardBatches()
    pendingTextLayout.clear()
    _graph = newGraph
    state.documentKind = _graph.documentKind
    setActiveTool(offeredTool(state, state.activeTool))
    subscribeToGraph()
    const previousPageId = state.currentPageId
    state.currentPageId = _graph.getPages()[0]?.id ?? _graph.rootId
    setSelectedIds(new Set())
    state.hoveredNodeId = null
    state.transforming = false
    state.measurementMode = 'off'
    state.snapGuides = []
    // Snap targets are points on the document's pages, which are gone.
    state.snapTargets = { points: [] }
    state.guides = { preview: null, hovered: null, selected: null, redline: null }
    state.layoutInsertIndicator = null
    state.dropTargetId = null
    pages.clearPageViewports()
    for (const renderer of _renderers) renderer.tiledScene.invalidateStructure()
    emitEditorEvent('graph:replaced', _graph)
    if (previousPageId !== state.currentPageId) {
      emitEditorEvent('page:changed', state.currentPageId, previousPageId)
    }
    requestRender()
  }

  function dispose() {
    canvas.releaseTextMeasurer()
    nodes.cancelNodePreviews()
    signals.clearInteractiveEdits()
    stopFontResolutionEvents()
    stopFontLoadEvents()
    stopUnblockEvents()
    unsubscribeFromGraph()
  }

  /** Releases what a document opened from a `.fig` holds: the editor's own, or one it replaced. */
  function releaseGraphResources(graph: SceneGraph = _graph) {
    releaseFigPopulationWorker(graph)
    releaseOriginalFigArchive(graph)
  }

  const editor = {
    get graph() {
      return _graph
    },
    get renderer() {
      return canvas.getRenderer()
    },
    get canvasRenderers() {
      return [..._renderers]
    },
    get textEditor() {
      return canvas.getTextEditor()
    },
    undo: guardUndo(undo, readOnly.historyRefusal),
    state,

    // Graph reads
    runLayoutForNode,
    runMutationWithLayout,
    ...graphReads,

    // Lifecycle
    beginInteractiveEdit,
    isInteractiveEditing: signals.isInteractiveEditing,
    isSyncingComponents,
    flushComponentSync,
    requestRender,
    requestRefresh,
    textSelectionChanged: signals.textSelectionChanged,
    requestRepaint,
    reportPresented: signals.reportPresented,
    onEditorEvent,
    setCanvasKit: canvas.setCanvasKit,
    setNavigationPhase,
    removeCanvasRenderer: canvas.removeCanvasRenderer,
    replaceGraph,
    subscribeToGraph,
    dispose,
    releaseGraphResources,

    // Selection
    ...selection,

    // Pages
    ...pages,

    // The canvas's size and the floating UI over its edges, as the host reports them
    ...viewportSize,

    // Canvas and frame guides
    ...guides,
    ...designIssues,

    // Shapes & tools
    ...shapeActions,

    // Vector edit mode: a path edited point by point, and the pen continuing a path
    ...vectorEditActions,
    cancelGesture,
    ...penResume,
    /**
     * Picks a tool. Only Move and the pen work on a path being edited, so picking another, such as
     * the hand with H, commits the path and leaves vector edit mode, as in Figma desktop 126; a
     * tool held while a key is down, as Space holds the hand, leaves it open.
     */
    setTool: (tool: Tool, options?: { held?: boolean }) => {
      const picked = !options?.held && offeredTool(state, tool) === tool
      if (picked && state.nodeEditState && tool !== 'SELECT' && tool !== 'PEN')
        vectorEdit.exitNodeEditMode(true)
      shapes.setTool(tool, options)
    },

    // Structure (group, reorder, reparent, z-order)
    ...structure,

    // Nodes (update, layout); while text is edited, character styles go to its selection
    ...nodes,
    updateNode: (id: string, changes: Partial<SceneNode>) =>
      textSelectionStyle.updateNode(id, changes, nodes.updateNode),
    updateNodeWithUndo: (id: string, changes: Partial<SceneNode>, label = 'Update') =>
      textSelectionStyle.updateNodeWithUndo(id, changes, (target, next) =>
        nodes.updateNodeWithUndo(target, next, label)
      ),
    getTextSelectionStyle: textSelectionStyle.selectionStyle,
    layerChanges: textSelectionStyle.layerChanges,

    // Alignment (align, flip, rotate)
    ...alignment,

    // Canvas views: editing, or a preview where instances with a behaviour respond to the pointer
    ...canvasViews,

    // Bitmap-to-vector replacement
    ...vectorize,
    ...icons,
    ...stickies,
    ...shapesWithText,
    ...figJamText,
    ...figJamColors,
    statusWorkflow: statuses.statusWorkflow,
    getShownStatus: statuses.getShownStatus,
    setStatus: statuses.setStatus,
    setStatusWorkflow: statuses.setStatusWorkflow,
    ...connectorDrawing,
    ...connectorEndpoints,
    ...connectorLines,
    ...lineEnds,
    ...connectorStyles,
    ...shaders,
    ...shaderFrames,

    // Variables
    ...variables,
    ...designTokens,

    // Text editing
    ...text,

    // Viewport
    ...viewport,
    ...frameNavigation,

    // Undo — bridge functions that need cross-module refs
    ...undoBridge,
    commitNodeUpdate: (id: string, previous: Partial<SceneNode>, label = 'Update') =>
      textSelectionStyle.commitNodeUpdate(
        id,
        previous,
        (target, values) => undoBridge.commitNodeUpdate(target, values, label),
        (target, next) => nodes.updateNodeWithUndo(target, next, label)
      ),
    // While text is edited, what was typed undoes first and the editor keeps the result.
    undoAction: () => text.runTextEditStep(undoBridge.undoAction),
    redoAction: () => text.runTextEditStep(undoBridge.redoAction),

    setDocumentColorSpace: colorSpace.setDocumentColorSpace,
    updateEnabledLibraries: documentSettings.updateEnabledLibraries,
    refreshDocumentSettings: documentSettings.refreshDocumentSettings,
    setDocumentKind: documentSettings.setDocumentKind,
    figCompression: figCompression.figCompression,
    setFigCompression: figCompression.setFigCompression,

    // Clipboard — bridge functions that need selectedNodes
    ...clipboardBridge,

    // Paste properties: the look of a copied layer, onto the selection
    ...clipboardProperties,

    // Components — bridge functions
    ...componentBridge,

    // Structure — bridge functions that need selectedNodes
    ...structureBridge,

    // Lint fixes, which touch nodes, structure and deletion in one undo step
    ...lintFixBridge,

    // Read-only documents, which refuse every action above that changes them
    ...readOnly.actions
  }
  return guardEdits(editor, readOnly.refusal)
}

/**
 * The editor `createEditor` returns. An interface rather than an alias, so declarations that
 * mention it, such as a Vue composable's inferred return type, name it instead of spelling out
 * its members, some of whose types are internal to Core.
 */
// eslint-disable-next-line typescript/no-empty-object-type -- The interface is the point: an alias's members are spelled out in emitted declarations.
export interface Editor extends ReturnType<typeof createEditor> {}
