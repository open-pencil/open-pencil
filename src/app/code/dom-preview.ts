import { browserHTMLToSceneGraph } from '@open-pencil/dom-css/browser'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/active-store'

export type DOMCodeSession = {
  originalGraph: SceneGraph
  originalPageId: string
  previewGraph: SceneGraph | null
  previewPageId: string | null
}

export function createDOMCodeSession(store: EditorStore): DOMCodeSession {
  return {
    originalGraph: store.graph,
    originalPageId: store.state.currentPageId,
    previewGraph: null,
    previewPageId: null
  }
}

export async function previewDOMCode(
  store: EditorStore,
  session: DOMCodeSession,
  source: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const graph = await browserHTMLToSceneGraph(source, { pageName: 'Code preview' })
    const pageId = graph.getPages()[0]?.id ?? graph.rootId
    session.previewGraph = graph
    session.previewPageId = pageId
    store.replaceGraph(graph)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function resetDOMCodePreview(store: EditorStore, session: DOMCodeSession): void {
  store.replaceGraph(session.originalGraph)
  void store.switchPage(session.originalPageId)
  session.previewGraph = null
  session.previewPageId = null
}

export function commitDOMCodeSession(store: EditorStore, session: DOMCodeSession): void {
  const after = session.previewGraph
  const afterPageId = session.previewPageId
  if (!after || !afterPageId) return
  store.pushUndoEntry({
    label: 'Edit HTML/CSS',
    forward: () => {
      store.replaceGraph(after)
      void store.switchPage(afterPageId)
    },
    inverse: () => {
      store.replaceGraph(session.originalGraph)
      void store.switchPage(session.originalPageId)
    }
  })
}
