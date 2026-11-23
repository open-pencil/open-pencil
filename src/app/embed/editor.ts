import { shallowReactive } from 'vue'

import type { RoomEditor } from '@open-pencil/collab'
import { createDefaultEditorState, createEditor, type Editor } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'
import { createShaderRasterizer } from '@open-pencil/vue/canvas/surface'

/**
 * The editor an embed shows its document in: Core's, as any SDK host builds it, read-only, so the
 * visitor can only look around: pan, zoom, select, and switch pages.
 */
export function createEmbedEditor(): Editor {
  const graph = new SceneGraph()
  const editor = createEditor({
    graph,
    state: shallowReactive(createDefaultEditorState(graph.getPages()[0].id)),
    shaderRasterizer: createShaderRasterizer()
  })
  editor.setReadOnly(true)
  return editor
}

/**
 * The embed's editor as its document's room sees it. It never saves and nobody renames the
 * document from it, so the room's changes apply as they come.
 */
export function embedRoomEditor(editor: Editor): RoomEditor {
  return {
    get graph() {
      return editor.graph
    },
    isReadOnly: () => true,
    onEditorEvent: editor.onEditorEvent,
    requestRender: () => editor.requestRender(),
    refreshVariables: (scope) => editor.refreshVariables(scope),
    refreshDocumentSettings: () => editor.refreshDocumentSettings(),
    adoptChanges: (apply) => apply(),
    get currentPageId() {
      return editor.state.currentPageId
    },
    switchPage: (pageId) => editor.switchPage(pageId),
    get documentName() {
      return editor.state.documentName
    },
    setDocumentName: (name) => {
      editor.state.documentName = name
    },
    onDocumentRenamed: () => () => undefined
  }
}
