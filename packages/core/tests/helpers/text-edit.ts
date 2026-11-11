import { noop } from 'es-toolkit'

import type { CanvasKit } from '@open-pencil/canvaskit'
import { createTextActions, type EditorContext, type EditorState } from '@open-pencil/core'
import { iconify } from '@open-pencil/core/icons'
import { TextEditor } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'
import { UndoManager } from '@open-pencil/scene-graph/undo'

/**
 * Text actions over a bare editor context with one 100 × 20 text layer, "Hello", on the page,
 * for tests that edit text and undo it without a canvas.
 */
export function setupTextEdit() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const undo = new UndoManager()
  const textEditor = new TextEditor({} as CanvasKit)

  const state = {
    editingTextId: null,
    currentPageId: pageId,
    renderVersion: 0,
    sceneVersion: 0,
    canvasVersion: 0
  } as EditorState

  const ctx: EditorContext = {
    graph,
    undo,
    state,
    requestRender: () => {
      state.renderVersion++
      state.sceneVersion++
      state.canvasVersion++
    },
    requestRefresh: () => {
      state.sceneVersion++
    },
    constrainMove: (_node, changes) => changes,
    getUserName: () => '',
    requestRepaint: () => {
      state.renderVersion++
    },
    getTextEditor: () => textEditor,
    getRenderer: () => null,
    getRenderers: () => [],
    runLayoutForNode: () => undefined,
    runMutationWithLayout: async (operation) => ({ result: await operation(), relayout: noop }),
    getCk: () => null,
    loadFont: async () => null,
    getViewportSize: () => ({ width: 800, height: 600 }),
    getViewportChrome: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
    icons: iconify,
    subscribeToGraph: () => undefined,
    resolveFigmaClipboardImages: null,
    beginInteractiveEdit: () => () => undefined,
    onEditorEvent: () => () => undefined,
    emitEditorEvent: () => undefined,
    setSelectedIds: () => undefined,
    setActiveTool: () => undefined,
    setNavigationPhase: () => undefined
  }

  const textNode = graph.createNode('TEXT', pageId, {
    name: 'Label',
    text: 'Hello',
    width: 100,
    height: 20
  })

  const actions = createTextActions(ctx)
  return { graph, undo, textEditor, state, textNode, actions }
}
