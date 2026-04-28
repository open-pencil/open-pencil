import type { Editor, EditorState } from '@open-pencil/core/editor'

type ReloadViewport = {
  panX: number
  panY: number
  zoom: number
}

export type ReloadStateSnapshot = {
  viewport: ReloadViewport
  pageId: string
}

export function captureReloadState(state: EditorState): ReloadStateSnapshot {
  return {
    viewport: { panX: state.panX, panY: state.panY, zoom: state.zoom },
    pageId: state.currentPageId
  }
}

export function restoreReloadState(editor: Editor, state: EditorState, snapshot: ReloadStateSnapshot) {
  state.selectedIds = new Set()
  if (editor.graph.getNode(snapshot.pageId)) {
    state.currentPageId = snapshot.pageId
  } else {
    state.currentPageId = editor.graph.getPages()[0]?.id ?? editor.graph.rootId
  }
  state.panX = snapshot.viewport.panX
  state.panY = snapshot.viewport.panY
  state.zoom = snapshot.viewport.zoom
}
