import { yieldToUI } from '@/app/document/io/browser'
import type { EditorStore } from '@/app/editor/session'
import { resolvedAppTheme } from '@/app/shell/theme'
import { createTab } from '@/app/tabs'

import { followAppTheme } from './theme'
import { showFirstChapter } from './viewport'

/** Built from `tools/generate/demo` before the app is served or bundled. */
const DEMO_URL = '/demo.fig'
const DEMO_FILE_NAME = 'Demo.fig'

/**
 * Opens the bundled demo document like any `.fig` file: decoded off the main thread, behind
 * the canvas loader. Once it is open it follows the app's theme and the view settles on the
 * first chapter.
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
  if (store.graph === blank) return
  followAppTheme(store, resolvedAppTheme)
  // Opening fits the whole page on the next frame; the first chapter comes after it.
  await yieldToUI()
  if (store.graph.getNode(store.state.currentPageId)) showFirstChapter(store)
}

/** Open the tour in a tab of its own, from the welcome dialog. */
export function openTour(): Promise<void> {
  return openDemoDocument(createTab().store)
}
