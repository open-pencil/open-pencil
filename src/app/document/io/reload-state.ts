import type { Editor, EditorState } from '@open-pencil/core'
import type { ViewportTransform } from '@open-pencil/core/geometry'

export type ReloadStateSnapshot = {
  viewport: ViewportTransform
  pageId: string
}

export function captureReloadState(state: EditorState): ReloadStateSnapshot {
  return {
    viewport: { panX: state.panX, panY: state.panY, zoom: state.zoom },
    pageId: state.currentPageId
  }
}

/**
 * Returns a reloaded document to the page and viewport it showed. A reload reads only the first
 * page's layers, so the page is opened through `switchPage`, which loads them: setting the page
 * alone would show it empty, with its layers missing from the document.
 */
export async function restoreReloadState(
  editor: Editor,
  state: EditorState,
  snapshot: ReloadStateSnapshot
) {
  editor.clearSelection()
  if (
    snapshot.pageId !== state.currentPageId &&
    editor.graph.getNode(snapshot.pageId)?.type === 'CANVAS'
  ) {
    await editor.switchPage(snapshot.pageId)
  }
  state.panX = snapshot.viewport.panX
  state.panY = snapshot.viewport.panY
  state.zoom = snapshot.viewport.zoom
}
