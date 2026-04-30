import { prefetchFigmaSchema } from '#core/clipboard'
import { IS_BROWSER } from '#core/constants'
import { setTextMeasurer } from '#core/layout'
import { SceneGraph } from '#core/scene-graph'
import { UndoManager } from '#core/scene-graph/undo'
import { TextEditor } from '#core/text/editor'
import { loadFont as defaultLoadFont } from '#core/text/fonts'
import { createClipboardBridge } from './bridges/clipboard'
import { createComponentBridge } from './bridges/components'
import { createStructureBridge } from './bridges/structure'
import { createUndoBridge } from './bridges/undo'
import { createAlignmentActions } from './alignment'
import { createClipboardActions } from './clipboard'
import { createColorSpaceActions } from './color-space'
import { createComponentActions } from './components'
import { createComponentSyncScheduler } from './component-sync'
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
import { createUndoActions } from './undo'
import { createVariableActions } from './variables'
import { createViewportActions } from './viewport'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { EditorContext, EditorOptions, EditorState } from './types'
import type { CanvasKit } from 'canvaskit-wasm'

export { createDefaultEditorState } from './state'

export function createEditor(options?: EditorOptions) {
  let _graph = options?.graph ?? new SceneGraph()
  const skipInitialGraphSetup = options?.skipInitialGraphSetup ?? false
  const undo = new UndoManager()
  const _loadFont = options?.loadFont ?? defaultLoadFont
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

  void prefetchFigmaSchema()

  const state: EditorState = options?.state ?? createDefaultEditorState(_graph.getPages()[0].id)

  function requestRender() {
    state.renderVersion++
    state.sceneVersion++
  }

  function requestRepaint() {
    state.renderVersion++
  }

  const graphReads = createGraphReadActions(() => _graph)
  const { runLayoutForNode } = createLayoutRunner(() => _graph)
  const { scheduleComponentSync } = createComponentSyncScheduler(() => _graph, requestRender)

  const { subscribeToGraph } = createGraphEventSubscription({
    getGraph: () => _graph,
    getRenderers: () => _renderers,
    scheduleComponentSync,
    requestRender
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
    getViewportSize: _getViewportSize,
    getCk: () => _ck,
    getRenderer: () => _renderer,
    getTextEditor: () => _textEditor,
    requestRender,
    requestRepaint,
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
  const alignment = createAlignmentActions(ctx)
  const clipboardBridge = createClipboardBridge(clipboard, selection)
  const componentBridge = createComponentBridge(components, selection, structure, pages)
  const structureBridge = createStructureBridge(structure, selection)
  const undoBridge = createUndoBridge(undoActions, selection)

  function setCanvasKit(ck: CanvasKit, renderer: SkiaRenderer) {
    _ck = ck
    _renderer = renderer
    _renderers.add(renderer)
    _textEditor ??= new TextEditor(ck)
    setTextMeasurer((node, maxWidth) => renderer.measureTextNode(node, maxWidth))
  }

  function removeCanvasRenderer(renderer: SkiaRenderer) {
    _renderers.delete(renderer)
    if (_renderer === renderer) {
      _renderer = _renderers.values().next().value ?? null
    }
  }

  function replaceGraph(newGraph: SceneGraph) {
    _graph = newGraph
    subscribeToGraph()
    state.currentPageId = _graph.getPages()[0]?.id ?? _graph.rootId
    state.selectedIds = new Set()
    state.hoveredNodeId = null
    pages.clearPageViewports()
    requestRender()
  }

  return {
    get graph() {
      return _graph
    },
    get renderer() {
      return _renderer
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
