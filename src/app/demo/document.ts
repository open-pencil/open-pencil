import type { EditorStore } from '@/app/editor/session'

import { fitDemoPagesOnFirstVisit } from './viewport'

/** Built from `tools/generate/demo` before the app is served or bundled. */
const DEMO_URL = '/demo.fig'
const DEMO_FILE_NAME = 'Demo.fig'

/**
 * Opens the bundled demo document like any `.fig` file: decoded off the main thread, behind
 * the canvas loader, with pages materialized as they are visited. Each page is fitted to the
 * viewport on its first visit.
 */
export async function openDemoDocument(store: EditorStore): Promise<void> {
  const blank = store.graph
  const response = await fetch(DEMO_URL)
  if (!response.ok) throw new Error(`The demo document is unavailable (${response.status})`)
  const file = new File([await response.arrayBuffer()], DEMO_FILE_NAME)
  // A file opened, or a layer drawn, while the demo was loading keeps the tab; the demo never
  // replaces them.
  const untouched =
    store.graph === blank &&
    store.state.preparation === null &&
    store.graph.getChildren(store.state.currentPageId).length === 0
  if (!untouched) return
  await store.openFigFile(file)
  const [, ...later] = store.graph.getPages()
  fitDemoPagesOnFirstVisit(
    store,
    later.map((page) => page.id)
  )
}
