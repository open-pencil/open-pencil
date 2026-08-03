import type { CanvasKit } from 'canvaskit-wasm'
import { createNanoEvents } from 'nanoevents'
import type { Emitter } from 'nanoevents'

import { SceneGraph } from '@open-pencil/scene-graph'
import { UndoManager } from '@open-pencil/scene-graph/undo'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { prefetchFigmaSchema } from '#core/clipboard'
import { IS_BROWSER } from '#core/constants'
import { setTextMeasurer } from '#core/layout'
import { TextEditor } from '#core/text/editor'
import { fontManager } from '#core/text/fonts'

import { createAlignmentActions } from './alignment'
import { createClipboardBridge } from './bridges/clipboard'
import { createComponentBridge } from './bridges/components'
import { createStructureBridge } from './bridges/structure'
import { createUndoBridge } from './bridges/undo'
import { createClipboardActions } from './clipboard'
import { createColorSpaceActions } from './color-space'
import { createComponentSyncScheduler } from './component-sync'
import { createComponentActions } from './components'
import { createGraphEventSubscription } from './graph-events'
import { createGraphReadActions } from './graph-reads'
import { createLayoutRunner } from './layout-runner'
import { createNodeActions } from './nodes'
import { createPageActions } from './pages'
import { createSelectionActions } from './selection'
import { createShapeActions } from './shapes'
import { createDefaultEditorState } from './state'
import { createStructureActions } from './structure'
import { createTextActions } from './text'
import type {
  CanvasRendererRole,
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

export { createDefaultEditorState } from './state'

/**
 * Diagnostic for the idle-upload loop.
 *
 * Autosave keys on `sceneVersion`, which `requestRender()` bumps from ~136 call
 * sites — many of which are not edits (lazy page population, async font
 * resolution, collaboration awareness). A document merely open therefore
 * re-saves indefinitely.
 *
 * Body identity already stops that costing bandwidth, but the local serialize
 * and IndexedDB write still churn. Fixing that means splitting a content
 * version out of the render counter, and doing so safely requires knowing WHICH
 * site fires while the document sits untouched — no call site has yet been
 * observed doing it.
 *
 * Enable in a dev build with `__openPencilTraceRender = true`, leave the
 * document alone, and read the stacks. Off by default and absent in production.
 */
function traceRenderRequest(): void {
  if (!import.meta.env.DEV) return
  const flag = (globalThis as { __openPencilTraceRender?: boolean }).__openPencilTraceRender
  if (!flag) return
  console.trace('[requestRender]')
}

export function createEditor(options?: EditorOptions) {
  let _graph = options?.graph ?? new SceneGraph()
  const skipInitialGraphSetup = options?.skipInitialGraphSetup ?? false
  const undo = new UndoManager()
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
  let _textEditor: TextEditor | null = null
  const events: Emitter<EditorEvents> = createNanoEvents()

  void prefetchFigmaSchema()

  const state: EditorState = options?.state ?? createDefaultEditorState(_graph.getPages()[0].id)

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
    traceRenderRequest()
    state.renderVersion++
    state.sceneVersion++
    emitEditorEvent('render:requested', {
      renderVersion: state.renderVersion,
      sceneVersion: state.sceneVersion
    })
  }

  function requestRepaint() {
    state.renderVersion++
    emitEditorEvent('repaint:requested', {
      renderVersion: state.renderVersion,
      sceneVersion: state.sceneVersion
    })
  }

  function setSelectedIds(ids: Set<string>) {
    const previous = [...state.selectedIds]
    state.selectedIds = ids
    const selected = [...ids]
    if (
      previous.length !== selected.length ||
      previous.some((id, index) => id !== selected[index])
    ) {
      emitEditorEvent('selection:changed', selected, previous)
    }
  }

  function setActiveTool(tool: EditorState['activeTool']) {
    const previous = state.activeTool
    state.activeTool = tool
    if (previous !== tool) emitEditorEvent('tool:changed', tool, previous)
  }

  const graphReads = createGraphReadActions(() => _graph)
  const { runLayoutForNode } = createLayoutRunner(() => _graph)
  const { scheduleComponentSync } = createComponentSyncScheduler(() => _graph, requestRender)

  const { subscribeToGraph } = createGraphEventSubscription({
    getGraph: () => _graph,
    getRenderers: () => _renderers,
    scheduleComponentSync,
    requestRender,
    emitEditorEvent
  })

  if (!skipInitialGraphSetup) {
    subscribeToGraph()
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
    getCk: () => _ck,
    getRenderer: () => _renderer,
    getTextEditor: () => _textEditor,
    requestRender,
    requestRepaint,
    emitEditorEvent,
    setSelectedIds,
    setActiveTool,
    runLayoutForNode,
    subscribeToGraph
  }

  // Assemble domain modules
  const viewport = createViewportActions(ctx)
  const selection = createSelectionActions(ctx)
  const pages = createPageActions(ctx)
  const shapes = createShapeActions(ctx)
  const structure = createStructureActions(ctx)
  const components = createComponentActions(ctx)
  const clipboard = createClipboardActions(ctx)
  const colorSpace = createColorSpaceActions(ctx)
  const undoActions = createUndoActions(ctx)
  const text = createTextActions(ctx)
  const nodes = createNodeActions(ctx)
  const variables = createVariableActions(ctx)
  const vectorize = createVectorizeActions(ctx)
  const alignment = createAlignmentActions(ctx)
  const clipboardBridge = createClipboardBridge(clipboard, selection)
  const componentBridge = createComponentBridge(components, selection, structure, pages)
  const structureBridge = createStructureBridge(structure, selection)
  const undoBridge = createUndoBridge(undoActions, selection)

  function selectRenderer(renderer: SkiaRenderer | null) {
    _renderer = renderer
    setTextMeasurer(
      renderer && typeof renderer.measureTextNode === 'function'
        ? (node, maxWidth) => renderer.measureTextNode(node, maxWidth)
        : null
    )
  }

  function setCanvasKit(
    ck: CanvasKit,
    renderer: SkiaRenderer,
    role: CanvasRendererRole = 'primary'
  ) {
    _ck = ck
    _renderers.add(renderer)
    _textEditor ??= new TextEditor(ck)
    // Renderer-backed exports and editor helpers must use the canvas that owns document
    // pixels. Auxiliary canvases (selection chrome, guides, cursors) still register so
    // graph mutations invalidate their caches, but they must not replace that authority.
    if (role === 'primary' || !_renderer) selectRenderer(renderer)
  }

  function removeCanvasRenderer(renderer: SkiaRenderer) {
    _renderers.delete(renderer)
    if (_renderer === renderer) {
      selectRenderer(_renderers.values().next().value ?? null)
    }
  }

  function replaceGraph(newGraph: SceneGraph) {
    _graph = newGraph
    subscribeToGraph()
    const previousPageId = state.currentPageId
    state.currentPageId = _graph.getPages()[0]?.id ?? _graph.rootId
    setSelectedIds(new Set())
    state.hoveredNodeId = null
    pages.clearPageViewports()
    emitEditorEvent('graph:replaced', _graph)
    if (previousPageId !== state.currentPageId) {
      emitEditorEvent('page:changed', state.currentPageId, previousPageId)
    }
    requestRender()
  }

  return {
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
    undo,
    state,

    // Graph reads
    ...graphReads,

    // Lifecycle
    requestRender,
    requestRepaint,
    onEditorEvent,
    setCanvasKit,
    removeCanvasRenderer,
    replaceGraph,
    subscribeToGraph,

    // Selection
    ...selection,

    // Pages
    ...pages,

    // Shapes & tools
    ...shapes,

    // Structure (group, reorder, reparent, z-order)
    ...structure,

    // Nodes (update, layout)
    ...nodes,

    // Alignment (align, flip, rotate)
    ...alignment,

    // Bitmap-to-vector replacement
    ...vectorize,

    // Variables
    ...variables,

    // Text editing
    ...text,

    // Viewport
    ...viewport,

    // Undo — bridge functions that need cross-module refs
    ...undoBridge,

    setDocumentColorSpace: colorSpace.setDocumentColorSpace,

    // Clipboard — bridge functions that need selectedNodes
    ...clipboardBridge,

    // Components — bridge functions
    ...componentBridge,

    // Structure — bridge functions that need selectedNodes
    ...structureBridge
  }
}

export type Editor = ReturnType<typeof createEditor>
