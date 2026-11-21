import type { ComponentStyling } from '@open-pencil/dom-css/export'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { errorMessage } from '@open-pencil/std/errors'

import { loadHTMLImporter } from '@/app/document/io/importer'
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

/** Every class the markup names, which Tailwind builds its utilities for. */
function classNames(html: string): string[] {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  return [...parsed.querySelectorAll('[class]')].flatMap((element) => [...element.classList])
}

/** Tailwind's own stylesheet, loaded with the first Tailwind preview rather than with the app. */
async function loadTailwindStylesheet(): Promise<string> {
  const { default: css } = await import('tailwindcss/index.css?raw')
  return css
}

async function designDocument(source: string, styling: ComponentStyling) {
  const { browserHTMLToDesignDocument, browserTailwindHTMLToDesignDocument } =
    await loadHTMLImporter()
  if (styling === 'css') return browserHTMLToDesignDocument(source)
  return browserTailwindHTMLToDesignDocument(source, classNames(source), {
    loadStylesheet: loadTailwindStylesheet
  })
}

export async function previewDOMCode(
  store: EditorStore,
  session: DOMCodeSession,
  source: string,
  styling: ComponentStyling
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { sceneGraphFromStyledHTML } = await loadHTMLImporter()
    const graph = await sceneGraphFromStyledHTML(await designDocument(source, styling), {
      pageName: 'Code preview'
    })
    const pageId = graph.getPages()[0]?.id ?? graph.rootId
    session.previewGraph = graph
    session.previewPageId = pageId
    store.replaceGraph(graph)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
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
