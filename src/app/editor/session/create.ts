import { shallowReactive } from 'vue'

import { createEditor } from '@open-pencil/core/editor'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/core/scene-graph'
import { fontManager } from '@open-pencil/core/text'

import {
  getActiveEditorStore,
  setActiveEditorStore,
  useEditorStore
} from '@/app/editor/active-store'
import { loadFont } from '@/app/editor/fonts'
import { logSplitPaneDebug } from '@/app/editor/panes/debug'
import { restorePanePageViewport, savePanePageViewport } from '@/app/editor/panes/page-viewports'
import { composePaneRenderState } from '@/app/editor/panes/render-state'
import {
  bindStateToActivePane,
  clearPaneTransientState,
  createCanvasPaneRegistry
} from '@/app/editor/panes/store'
import type { SplitDirection } from '@/app/editor/panes/types'
import {
  createEditorComputedRefs,
  createEditorStoreModules,
  defineEditorStoreAccessors
} from '@/app/editor/session/modules'
import { createInitialAppEditorState, type AppEditorState } from '@/app/editor/session/types'

export { EDITOR_TOOLS as TOOLS, TOOL_SHORTCUTS } from '@open-pencil/core/editor'
export type { EditorToolDef as ToolDef, Tool } from '@open-pencil/core/editor'

export function createEditorStore(initialGraph?: SceneGraph) {
  const graph = initialGraph ?? new SceneGraph()

  const state = shallowReactive<AppEditorState>(createInitialAppEditorState(graph.getPages()[0].id))
  const panes = createCanvasPaneRegistry({ graph, state })
  const paneCleanupHandlers = new Map<string, Set<() => void>>()
  bindStateToActivePane(state, panes)

  const viewportSize = { width: 0, height: 0 }
  const editor = createEditor({
    graph,
    state,
    loadFont,
    skipInitialGraphSetup: !!initialGraph,
    getViewportSize: () => {
      const pane = panes.getActivePane()
      if (pane.viewportWidth > 0 && pane.viewportHeight > 0) {
        return { width: pane.viewportWidth, height: pane.viewportHeight }
      }
      return viewportSize.width > 0 && viewportSize.height > 0
        ? viewportSize
        : { width: window.innerWidth, height: window.innerHeight }
    }
  })
  const io = new IORegistry(BUILTIN_IO_FORMATS)

  if (initialGraph) {
    editor.subscribeToGraph()
  }

  const { selectedNodes, selectedNode, layerTree } = createEditorComputedRefs(editor, state)

  const modules = createEditorStoreModules(editor, graph, state, io, viewportSize)

  async function switchPage(pageId: string) {
    const page = editor.graph.getNode(pageId)
    if (page?.type !== 'CANVAS') return
    const pane = panes.getActivePane()
    runPaneCleanup(pane.id)
    if (state.editingTextId) editor.commitTextEdit()
    savePanePageViewport(pane)
    pane.currentPageId = pageId
    pane.enteredContainerId = null
    pane.selectedIds = new Set()
    restorePanePageViewport(pane, pageId)

    const toLoad = fontManager.collectFontKeys(
      editor.graph,
      editor.graph.getChildren(pageId).map((node) => node.id)
    )
    if (toLoad.length > 0) {
      await Promise.all(toLoad.map(([family, style]) => loadFont(family, style)))
    }
    if (editor.renderer) computeAllLayouts(editor.graph, pageId)
    editor.requestRender()
  }

  function runPaneCleanup(paneId: string): void {
    const handlers = paneCleanupHandlers.get(paneId)
    if (!handlers) return
    logSplitPaneDebug('run-pane-cleanup', { paneId, handlerCount: handlers.size })
    for (const cleanup of handlers) cleanup()
  }

  function registerPaneCleanup(paneId: string, cleanup: () => void): () => void {
    const handlers = paneCleanupHandlers.get(paneId) ?? new Set<() => void>()
    handlers.add(cleanup)
    paneCleanupHandlers.set(paneId, handlers)
    return () => {
      handlers.delete(cleanup)
      if (handlers.size === 0) paneCleanupHandlers.delete(paneId)
    }
  }

  function setActivePane(paneId: string) {
    if (panes.activePaneId.value === paneId || !panes.getPane(paneId)) return
    if (panes.splitResizeActive.value) {
      logSplitPaneDebug('set-active-pane-blocked', { from: panes.activePaneId.value, to: paneId })
      return
    }
    logSplitPaneDebug('set-active-pane', { from: panes.activePaneId.value, to: paneId })
    runPaneCleanup(panes.activePaneId.value)
    if (state.editingTextId) editor.commitTextEdit()
    panes.setActivePane(paneId)
    editor.requestRepaint()
  }

  function splitPane(paneId: string, direction: SplitDirection) {
    if (state.editingTextId) editor.commitTextEdit()
    const result = panes.splitPane(paneId, direction)
    if (result.ok) editor.requestRepaint()
    return result
  }

  function closePane(paneId: string) {
    const pane = panes.getPane(paneId)
    if (!pane) return panes.closePane(paneId)
    if (panes.visiblePaneCount.value <= 1)
      return { ok: false as const, reason: 'last-pane' as const }

    const isActivePane = panes.activePaneId.value === paneId
    runPaneCleanup(paneId)
    if (isActivePane && state.editingTextId) editor.commitTextEdit()
    clearPaneTransientState(pane)
    const result = panes.closePane(paneId)
    if (result.ok) editor.requestRepaint()
    return result
  }

  function deletePage(pageId: string) {
    editor.deletePage(pageId)
    panes.sanitizePanes(editor.graph)
    editor.requestRender()
  }

  function replaceGraph(newGraph: SceneGraph) {
    for (const paneId of paneCleanupHandlers.keys()) runPaneCleanup(paneId)
    if (state.editingTextId) editor.commitTextEdit()
    editor.replaceGraph(newGraph)
    panes.sanitizePanes(editor.graph)
    panes.resetPaneViewports()
  }

  function ensureSinglePane() {
    for (const paneId of paneCleanupHandlers.keys()) {
      if (paneId !== panes.activePaneId.value) runPaneCleanup(paneId)
    }
    const paneId = panes.ensureSinglePane()
    editor.requestRepaint()
    return paneId
  }

  function requestRepaint() {
    const activePaneId = panes.activePaneId.value
    for (const pane of panes.panes.value.values()) {
      if (pane.id !== activePaneId) pane.renderVersion++
    }
    editor.requestRepaint()
  }

  const store = {
    ...editor,
    state,
    selectedNodes,
    selectedNode,
    layerTree,
    panes,
    splitTree: panes.splitTree,
    activePaneId: panes.activePaneId,
    splitResizeActive: panes.splitResizeActive,
    visiblePaneCount: panes.visiblePaneCount,
    maxVisiblePanes: panes.maxVisiblePanes,
    getPane: panes.getPane,
    getActivePane: panes.getActivePane,
    requestRepaint,
    setActivePane,
    setSplitResizeActive: panes.setSplitResizeActive,
    splitPane,
    closePane,
    ensureSinglePane,
    registerPaneCleanup,
    resizePane: panes.resizePane,
    updateSplitSizes: panes.updateSplitSizes,
    getPaneRenderState: (paneId: string) => {
      const pane = panes.getPane(paneId) ?? panes.getActivePane()
      return composePaneRenderState(state, pane)
    },
    ...modules,
    switchPage,
    deletePage,
    replaceGraph
  }

  defineEditorStoreAccessors(store, editor)

  return store
}

export type EditorStore = ReturnType<typeof createEditorStore>

export { getActiveEditorStore, setActiveEditorStore, useEditorStore }
