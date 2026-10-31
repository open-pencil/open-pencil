import type { CanvasKit } from 'canvaskit-wasm'
import { createNanoEvents } from 'nanoevents'
import type { Emitter } from 'nanoevents'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { UndoManager } from '@open-pencil/scene-graph/undo'

import type { SkiaRenderer } from '#core/canvas/renderer'
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
import { installTextMeasurer } from '#core/layout'
import { createLayoutRunner } from '#core/layout/mutations'
import { emitNavigationTrace } from '#core/profiler'
import { TextEditor } from '#core/text/editor'
import { fontManager } from '#core/text/font/manager'
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
import { createComponentSyncScheduler } from './component-sync'
import { createComponentActions } from './components'
import { createConnectorDrawActions, createConnectorEndpointActions } from './connectors/draw'
import { createConnectorLineActions } from './connectors/line'
import { createConnectorRouting } from './connectors/routing'
import { createConnectorStyleActions } from './connectors/style'
import { createDesignTokenActions } from './design-tokens'
import { createDocumentSettingsActions } from './document-settings'
import { createFigCompressionActions } from './fig-compression'
import { createGraphEventSubscription } from './graph-events'
import { createGraphReadActions } from './graph-reads'
import { createGuideActions } from './guides'
import { createIconActions } from './icons'
import { createDesignIssueActions } from './issues'
import { createLineEndActions } from './line-ends'
import { createNodeActions } from './nodes'
import { createPageActions } from './pages'
import { createReadOnlyActions, guardReadOnly, guardUndo } from './read-only'
import { createSelectionActions } from './selection'
import { createShaderActions } from './shaders/actions'
import { createShaderFrames } from './shaders/frames'
import { createShapeActions } from './shapes'
import { createShapeWithTextActions } from './shapes/with-text'
import { createDefaultEditorState } from './state'
import { createStatusActions } from './statuses'
import { createStickyActions } from './stickies'
import { createStructureActions } from './structure'
import { createTextActions } from './text'
import { createPendingTextLayout } from './text/pending-layout'
import { createTextSelectionStyle } from './text/selection-style'
import { createGeneratedTextActions } from './text/typeface'
import type {
  EditorContext,
  EditorEventName,
  EditorEvents,
  EditorOptions,
  EditorState
} from './types'
import { createUndoActions } from './undo'
import { createVariableActions } from './variables'
import { createVectorizeActions } from './vectorize'
import { createViewportActions } from './viewport'
import { createCanvasViewActions, offeredTool, resolveEditorProfile } from './views'

export { createDefaultEditorState } from './state'

export function createEditor(options?: EditorOptions) {
  let _graph = options?.graph ?? new SceneGraph()
  const skipInitialGraphSetup = options?.skipInitialGraphSetup ?? false
  const undo = new UndoManager({ onChange: () => emitEditorEvent('history:changed') })
  const _loadFont = options?.loadFont ?? fontManager.loadFont.bind(fontManager)
  const _getViewportSize =
    options?.getViewportSize ??
    (() => {
      if (IS_BROWSER) return { width: window.innerWidth, height: window.innerHeight }
      return { width: 800, height: 600 }
    })
  let _ck: CanvasKit | null = null
  let _renderer: SkiaRenderer | null = null
  const _renderers = new Set<SkiaRenderer>()
  let uninstallTextMeasurer: (() => void) | null = null
  const interactiveEdits = new Set<symbol>()
  let _textEditor: TextEditor | null = null
  const events: Emitter<EditorEvents> = createNanoEvents()
  const stopFontResolutionEvents = fontResolver.subscribe((event, snapshot) => {
    if (event === 'settled') pendingTextLayout.relayoutReady(_renderer)
    events.emit('font:resolution-changed', event, snapshot)
  })
  const stopFontLoadEvents = fontManager.onFaceLoaded((family, style) =>
    events.emit('font:loaded', family, style)
  )

  void prefetchFigmaSchema()

  const state: EditorState = options?.state ?? createDefaultEditorState(_graph.getPages()[0].id)
  state.documentKind = _graph.documentKind
  state.activeTool = offeredTool(state, state.activeTool)

  function emitEditorEvent<K extends EditorEventName>(
    event: K,
    ...args: Parameters<EditorEvents[K]>
  ) {
    events.emit(event, ...args)
  }

  function onEditorEvent<K extends EditorEventName>(event: K, handler: EditorEvents[K]) {
    return events.on(event, handler)
  }

  function requestRender() {
    state.renderVersion++
    state.sceneVersion++
    state.canvasVersion++
    emitNavigationTrace('render:requested', {
      kind: 'render',
      renderVersion: state.renderVersion,
      sceneVersion: state.sceneVersion
    })
    emitEditorEvent('render:requested', {
      renderVersion: state.renderVersion,
      sceneVersion: state.sceneVersion
    })
  }

  /**
   * The caret or selection of the edited text moved: the canvas repaints its overlay and the
   * views that follow the selection update, without the document counting as changed.
   */
  function textSelectionChanged() {
    state.textSelectionVersion++
    requestRepaint()
  }

  function requestRefresh() {
    state.sceneVersion++
  }

  function requestRepaint() {
    state.renderVersion++
    emitNavigationTrace('render:requested', {
      kind: 'repaint',
      renderVersion: state.renderVersion,
      sceneVersion: state.sceneVersion
    })
    emitEditorEvent('repaint:requested', {
      renderVersion: state.renderVersion,
      sceneVersion: state.sceneVersion
    })
  }

  /** Track an actual live edit independently of history batching. Release is idempotent. */
  function beginInteractiveEdit() {
    const token = Symbol('interactive-edit')
    interactiveEdits.add(token)
    requestRepaint()
    return () => {
      if (interactiveEdits.delete(token)) requestRepaint()
    }
  }

  function setNavigationPhase(phase: EditorState['navigation']['phase'], inputAt = 0) {
    const previous = { ...state.navigation }
    const active = phase === 'pan' || phase === 'zoom' || phase === 'momentum'
    const wasActive =
      previous.phase === 'pan' || previous.phase === 'zoom' || previous.phase === 'momentum'
    state.navigation = {
      phase,
      generation: active && !wasActive ? previous.generation + 1 : previous.generation,
      lastInputAt: inputAt || previous.lastInputAt
    }
    if (
      state.navigation.phase !== previous.phase ||
      state.navigation.generation !== previous.generation ||
      state.navigation.lastInputAt !== previous.lastInputAt
    ) {
      emitNavigationTrace('navigation:phase', {
        phase: state.navigation.phase,
        previousPhase: previous.phase,
        generation: state.navigation.generation,
        lastInputAt: state.navigation.lastInputAt
      })
      emitEditorEvent('navigation:changed', state.navigation, previous)
    }
  }

  function setSelectedIds(ids: Set<string>) {
    const previous = [...state.selectedIds]
    state.selectedIds = ids
    if (ids.size === 0) state.measurementMode = 'off'
    const selected = [...ids]
    if (
      previous.length !== selected.length ||
      previous.some((id, index) => id !== selected[index])
    ) {
      emitEditorEvent('selection:changed', selected, previous)
    }
  }

  function setActiveTool(tool: EditorState['activeTool']) {
    if (offeredTool(state, tool) !== tool) return
    const previous = state.activeTool
    state.activeTool = tool
    if (tool !== 'SELECT') state.measurementMode = 'off'
    if (previous === tool) return
    // Guides the pen showed for its next point do not belong to the next tool.
    if (previous === 'PEN') state.snapGuides = []
    emitEditorEvent('tool:changed', tool, previous)
  }

  const graphReads = createGraphReadActions(() => _graph)
  const { runLayoutForNode, runMutationWithLayout } = createLayoutRunner(() => _graph)
  const pendingTextLayout = createPendingTextLayout({
    getGraph: () => _graph,
    runLayoutForNode,
    requestRender
  })
  const { scheduleComponentSync } = createComponentSyncScheduler(() => _graph, requestRender)

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
    getViewportSize: _getViewportSize,
    getUserName: () => options?.getUserName?.() ?? '',
    icons: options?.icons ?? defaultIcons,
    getCk: () => _ck,
    getRenderer: () => _renderer,
    getRenderers: () => _renderers,
    getTextEditor: () => _textEditor,
    requestRender,
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
  const generatedText = createGeneratedTextActions(ctx, nodes)
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
  /** Whether the editor refuses edits: its profile offers none, as for a read-only document. */
  const readsOnly = () => !resolveEditorProfile(state).edits
  const readOnly = createReadOnlyActions(ctx, () => {
    nodes.flushNudge()
    nodes.cancelNodePreviews()
    if (state.editingTextId) text.commitTextEdit()
    shapes.penCancel()
    shapes.pencilCancel()
    state.gradientEdit = null
  })

  // The edited text follows changes made outside the editor, such as a panel field being
  // dragged, so its caret and selection move with the text instead of after the change.
  const invalidateEditedText = (id: string) => {
    if (id !== state.editingTextId) return
    const node = _graph.getNode(id)
    if (node) _textEditor?.invalidateParagraph(node)
  }
  onEditorEvent('node:updated', invalidateEditedText)
  onEditorEvent('node:previewUpdated', invalidateEditedText)

  function setCanvasKit(ck: CanvasKit, renderer: SkiaRenderer) {
    _ck = ck
    _renderer = renderer
    _renderers.add(renderer)
    _textEditor ??= new TextEditor(ck)
    uninstallTextMeasurer?.()
    uninstallTextMeasurer =
      typeof renderer.measureTextNode === 'function'
        ? installTextMeasurer((node, maxWidth) =>
            pendingTextLayout.measure(renderer, node, maxWidth)
          )
        : null
  }

  function releaseTextMeasurer() {
    uninstallTextMeasurer?.()
    uninstallTextMeasurer = null
  }

  function removeCanvasRenderer(renderer: SkiaRenderer) {
    _renderers.delete(renderer)
    if (_renderer === renderer) {
      _renderer = _renderers.values().next().value ?? null
    }
    if (_renderers.size === 0) releaseTextMeasurer()
  }

  function replaceGraph(newGraph: SceneGraph) {
    nodes.cancelNodePreviews()
    undo.discardBatches()
    _graph = newGraph
    state.documentKind = _graph.documentKind
    setActiveTool(offeredTool(state, state.activeTool))
    pendingTextLayout.clear()
    subscribeToGraph()
    const previousPageId = state.currentPageId
    state.currentPageId = _graph.getPages()[0]?.id ?? _graph.rootId
    setSelectedIds(new Set())
    state.hoveredNodeId = null
    state.transforming = false
    state.measurementMode = 'off'
    state.snapGuides = []
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
    releaseTextMeasurer()
    nodes.cancelNodePreviews()
    interactiveEdits.clear()
    stopFontResolutionEvents()
    stopFontLoadEvents()
    unsubscribeFromGraph()
  }

  function releaseGraphResources() {
    releaseFigPopulationWorker(_graph)
    releaseOriginalFigArchive(_graph)
  }

  const editor = {
    get graph() {
      return _graph
    },
    get renderer() {
      return _renderer
    },
    get canvasRenderers() {
      return [..._renderers]
    },
    get textEditor() {
      return _textEditor
    },
    undo: guardUndo(undo, readsOnly),
    state,

    // Graph reads
    runLayoutForNode,
    runMutationWithLayout,
    ...graphReads,

    // Lifecycle
    beginInteractiveEdit,
    isInteractiveEditing: () => interactiveEdits.size > 0,
    requestRender,
    requestRefresh,
    textSelectionChanged,
    requestRepaint,
    onEditorEvent,
    setCanvasKit,
    setNavigationPhase,
    removeCanvasRenderer,
    replaceGraph,
    subscribeToGraph,
    dispose,
    releaseGraphResources,

    // Selection
    ...selection,

    // Pages
    ...pages,

    // Canvas and frame guides
    ...guides,
    ...designIssues,

    // Shapes & tools
    ...shapes,

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

    // Alignment (align, flip, rotate)
    ...alignment,

    // Canvas views: editing, or a preview where instances with a behaviour respond to the pointer
    ...canvasViews,

    // Bitmap-to-vector replacement
    ...vectorize,
    ...icons,
    ...stickies,
    ...shapesWithText,
    ...generatedText,
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
    ...readOnly
  }
  return guardReadOnly(editor, readsOnly)
}

/**
 * The editor `createEditor` returns. An interface rather than an alias, so declarations that
 * mention it, such as a Vue composable's inferred return type, name it instead of spelling out
 * its members, some of whose types are internal to Core.
 */
// eslint-disable-next-line typescript/no-empty-object-type -- The interface is the point: an alias's members are spelled out in emitted declarations.
export interface Editor extends ReturnType<typeof createEditor> {}
