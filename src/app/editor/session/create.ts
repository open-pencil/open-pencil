import { shallowReactive } from 'vue'

import { createEditor } from '@open-pencil/core/editor'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { SceneGraph } from '@open-pencil/scene-graph'

import {
  getActiveEditorStore,
  setActiveEditorStore,
  useEditorStore
} from '@/app/editor/active-store'
import { resolveFigmaClipboardImages } from '@/app/editor/clipboard/figma-images'
import { bindClipboardNotifications } from '@/app/editor/clipboard/notifications'
import { loadFont } from '@/app/editor/fonts'
import {
  createEditorComputedRefs,
  createEditorStoreModules,
  defineEditorStoreAccessors
} from '@/app/editor/session/modules'
import { createInitialAppEditorState, type AppEditorState } from '@/app/editor/session/types'
import { isTauri } from '@/app/tauri/env'

export { EDITOR_TOOLS as TOOLS, TOOL_SHORTCUTS } from '@open-pencil/core/editor'
export type { EditorToolDef as ToolDef, Tool } from '@open-pencil/core/editor'

export function createEditorStore(initialGraph?: SceneGraph) {
  const graph = initialGraph ?? new SceneGraph()

  const state = shallowReactive<AppEditorState>(createInitialAppEditorState(graph.getPages()[0].id))

  const viewportSize = { width: 0, height: 0 }
  const editor = createEditor({
    graph,
    state,
    loadFont,
    resolveFigmaClipboardImages: isTauri() ? resolveFigmaClipboardImages : undefined,
    skipInitialGraphSetup: !!initialGraph,
    getViewportSize: () =>
      viewportSize.width > 0 && viewportSize.height > 0
        ? viewportSize
        : { width: window.innerWidth, height: window.innerHeight }
  })
  const io = new IORegistry(BUILTIN_IO_FORMATS)
  bindClipboardNotifications(editor)

  if (initialGraph) {
    editor.subscribeToGraph()
  }

  const { selectedNodes, selectedNode, layerTree } = createEditorComputedRefs(editor, state)

  const modules = createEditorStoreModules(editor, graph, state, io, viewportSize)

  // ─── Public API ───────────────────────────────────────────────
  // Spread all core Editor methods, then override getters and add app-specific.

  const store = {
    ...editor,
    state,
    selectedNodes,
    selectedNode,
    layerTree,

    // App-specific overrides and additions
    ...modules
  }

  defineEditorStoreAccessors(store, editor)

  return store
}

export type EditorStore = ReturnType<typeof createEditorStore>

export { getActiveEditorStore, setActiveEditorStore, useEditorStore }
