import { prefetchFigmaSchema } from '../clipboard'
import { getDefaultCanvasBgColor, IS_BROWSER } from '../constants'
import { computeAllLayouts, computeLayout, setTextMeasurer } from '../layout'
import { SceneGraph } from '../scene-graph'
import { UndoManager } from '../scene-graph/undo'
import { TextEditor } from '../text/editor'
import { loadFont as defaultLoadFont } from '../text/fonts'
import { createAlignmentActions } from './alignment'
import { createClipboardActions } from './clipboard'
import { createColorSpaceActions } from './color-space'
import { createComponentActions } from './components'
import { createNodeActions } from './nodes'
import { createPageActions } from './pages'
import { createSelectionActions } from './selection'
import { createShapeActions } from './shapes'
import { createStructureActions } from './structure'
import { createTextActions } from './text'
import { createUndoActions } from './undo'
import { createVariableActions } from './variables'
import { createViewportActions } from './viewport'

import type { SkiaRenderer } from '../canvas/renderer'
import type { SceneNode } from '../scene-graph'
import type { EditorContext, EditorOptions, EditorState } from './types'
import type { CanvasKit } from 'canvaskit-wasm'

export function createDefaultEditorState(pageId: string): EditorState {
  return {
    activeTool: 'SELECT',
    currentPageId: pageId,
    selectedIds: new Set<string>(),
    marquee: null,
    snapGuides: [],
    rotationPreview: null,
    dropTargetId: null,
    layoutInsertIndicator: null,
    hoveredNodeId: null,
    editingTextId: null,
    penState: null,
    penCursorX: null,
    penCursorY: null,
    remoteCursors: [],
    documentName: 'Untitled',
    panX: 0,
    pageColor: { ...getDefaultCanvasBgColor() },
    panY: 0,
    zoom: 1,
    renderVersion: 0,
    sceneVersion: 0,
    loading: false,
    enteredContainerId: null
  }
}

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

  function runLayoutForNode(id: string) {
    const node = _graph.getNode(id)
    if (!node) return

    computeAllLayouts(_graph, id)

    let parent = node.parentId ? _graph.getNode(node.parentId) : undefined
    while (parent) {
      if (parent.layoutMode !== 'NONE') {
        computeLayout(_graph, parent.id)
      }
      parent = parent.parentId ? _graph.getNode(parent.parentId) : undefined
    }
  }

  // Microtask-batched component sync
  let pendingComponentSync: Set<string> | null = null

  function flushComponentSync() {
    const ids = pendingComponentSync
    if (!ids) return
    pendingComponentSync = null
    const componentIds = new Set<string>()
    for (const id of ids) {
      let current = _graph.getNode(id)
      while (current) {
        if (current.type === 'COMPONENT') {
          componentIds.add(current.id)
          break
        }
        current = current.parentId ? _graph.getNode(current.parentId) : undefined
      }
    }
    for (const compId of componentIds) {
      _graph.syncInstances(compId)
    }
    if (componentIds.size > 0) requestRender()
  }

  function scheduleComponentSync(nodeId: string) {
    if (!pendingComponentSync) {
      pendingComponentSync = new Set()
      queueMicrotask(flushComponentSync)
    }
    pendingComponentSync.add(nodeId)
  }

  function onNodeUpdated(id: string, changes: Partial<SceneNode>) {
    if ('vectorNetwork' in changes) {
      _renderer?.invalidateVectorPath(id)
    }
    _renderer?.invalidateNodePicture(id)
    scheduleComponentSync(id)
    requestRender()
  }

  function onNodeStructureChanged(nodeId: string) {
    scheduleComponentSync(nodeId)
    requestRender()
  }

  let graphUnbinds: Array<() => void> = []

  function subscribeToGraph() {
    for (const u of graphUnbinds) u()
    graphUnbinds = [
      _graph.emitter.on('node:updated', onNodeUpdated),
      _graph.emitter.on('node:created', (node) => onNodeStructureChanged(node.id)),
      _graph.emitter.on('node:deleted', onNodeStructureChanged),
      _graph.emitter.on('node:reparented', onNodeStructureChanged),
      _graph.emitter.on('node:reordered', onNodeStructureChanged)
    ]
  }

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

  function setCanvasKit(ck: CanvasKit, renderer: SkiaRenderer) {
    _ck = ck
    _renderer = renderer
    _textEditor = new TextEditor(ck)
    setTextMeasurer((node, maxWidth) => renderer.measureTextNode(node, maxWidth))
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
    getNode: (id: string) => _graph.getNode(id),
    getImage: (hash: string) => _graph.images.get(hash),
    getChildren: (id: string) => _graph.getChildren(id),
    getPages: (includeInternal?: boolean) => _graph.getPages(includeInternal),

    // Lifecycle
    requestRender,
    requestRepaint,
    setCanvasKit,
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
    commitMove: undoActions.commitMove,
    commitMoveWithReparent: undoActions.commitMoveWithReparent,
    commitResize: undoActions.commitResize,
    commitRotation: undoActions.commitRotation,
    commitNodeUpdate: undoActions.commitNodeUpdate,
    undoAction: () => undoActions.undoAction(selection.validateEnteredContainer),
    redoAction: () => undoActions.redoAction(selection.validateEnteredContainer),
    snapshotPage: undoActions.snapshotPage,
    restorePageFromSnapshot: undoActions.restorePageFromSnapshot,
    pushUndoEntry: undoActions.pushUndoEntry,

    setDocumentColorSpace: colorSpace.setDocumentColorSpace,

    // Clipboard — bridge functions that need selectedNodes
    duplicateSelected: () => clipboard.duplicateSelected(selection.getSelectedNodes()),
    writeCopyData: (data: DataTransfer) =>
      clipboard.writeCopyData(data, selection.getSelectedNodes()),
    pasteFromHTML: clipboard.pasteFromHTML,
    deleteSelected: clipboard.deleteSelected,
    storeImage: clipboard.storeImage,
    placeImageFiles: clipboard.placeImageFiles,
    loadFontsForNodes: clipboard.loadFontsForNodes,
    copySelectionAsText: clipboard.copySelectionAsText,
    copySelectionAsSVG: clipboard.copySelectionAsSVG,
    copySelectionAsJSX: clipboard.copySelectionAsJSX,

    // Components — bridge functions
    createComponentFromSelection: () =>
      components.createComponentFromSelection(
        selection.getSelectedNodes(),
        structure.wrapSelectionInContainer
      ),
    createComponentSetFromComponents: () =>
      components.createComponentSetFromComponents(
        selection.getSelectedNodes(),
        structure.wrapSelectionInContainer
      ),
    createInstanceFromComponent: components.createInstanceFromComponent,
    detachInstance: () => components.detachInstance(selection.getSelectedNode()),
    goToMainComponent: () =>
      components.goToMainComponent(selection.getSelectedNode(), pages.switchPage),

    // Structure — bridge functions that need selectedNodes
    wrapInAutoLayout: () => structure.wrapInAutoLayout(selection.getSelectedNodes()),
    groupSelected: () => structure.groupSelected(selection.getSelectedNodes()),
    ungroupSelected: () => structure.ungroupSelected(selection.getSelectedNode())
  }
}

export type Editor = ReturnType<typeof createEditor>
