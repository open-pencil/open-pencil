import type { RoomEditor } from '@open-pencil/collab'

import type { EditorStore } from '@/app/editor/active-store'

/** A tab's editor as its room sees it. */
export function collabEditor(store: EditorStore): RoomEditor {
  return {
    get graph() {
      return store.graph
    },
    isReadOnly: () => store.state.hostRestrictions.readOnly,
    onEditorEvent: store.onEditorEvent,
    requestRender: () => store.requestRender(),
    refreshVariables: (scope) => store.refreshVariables(scope),
    refreshDocumentSettings: () => store.refreshDocumentSettings(),
    adoptChanges: (apply) => store.adoptChanges(apply),
    get currentPageId() {
      return store.state.currentPageId
    },
    switchPage: (pageId) => store.switchPage(pageId),
    get documentName() {
      return store.state.documentName
    },
    setDocumentName: (name) => {
      store.state.documentName = name
    },
    onDocumentRenamed: (handler) => store.onDocumentRenamed(handler).off
  }
}
