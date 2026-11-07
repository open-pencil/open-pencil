import type { SceneGraph } from '@open-pencil/scene-graph'
import { nextFrame } from '@open-pencil/vue/shared/frame'

import type { EditorStore } from '@/app/editor/session'
import { notificationMessages } from '@/app/i18n/notifications'
import { resolvedAppTheme } from '@/app/shell/theme'
import { toast } from '@/app/shell/ui'
import { closeTab, createTab } from '@/app/tabs'

import { followAppTheme } from './theme'
import { showFirstChapter } from './viewport'

/** Built from `tools/generate/demo` before the app is served or bundled. */
const DEMO_URL = '/demo.fig'
const DEMO_FILE_NAME = 'Demo.fig'

/** Nothing has been opened or drawn in the store since it showed `blank`. */
function untouched(store: EditorStore, blank: SceneGraph): boolean {
  return (
    store.graph === blank &&
    store.state.preparation === null &&
    store.graph.getChildren(store.state.currentPageId).length === 0
  )
}

/**
 * Opens the bundled demo document like any `.fig` file: decoded off the main thread, behind
 * the canvas loader. Once it is open it follows the app's theme and the view settles on the
 * first chapter. Resolves whether the demo opened: not when the tab was used while it loaded.
 */
export async function openDemoDocument(store: EditorStore): Promise<boolean> {
  const blank = store.graph
  const response = await fetch(DEMO_URL)
  if (!response.ok) throw new Error(`The demo document is unavailable (${response.status})`)
  const file = new File([await response.arrayBuffer()], DEMO_FILE_NAME)
  // A file opened, or a layer drawn, while the demo was loading keeps the tab; the demo never
  // replaces them.
  if (!untouched(store, blank)) return false
  await store.openFigFile(file)
  if (store.graph === blank) return false
  // In the store's scope: this runs after an `await`, where no scope would stop it on close.
  store.runInScope(() => followAppTheme(store, resolvedAppTheme))
  // Opening fits the whole page on the next frame; the first chapter comes after it.
  await nextFrame()
  if (store.graph.getNode(store.state.currentPageId)) showFirstChapter(store)
  return true
}

/**
 * Open the tour in a tab of its own, from the welcome dialog or the File menu. If the tour fails
 * to load, its tab closes again unless something was opened or drawn in it meanwhile. Resolves
 * whether the tour opened, which it does not when the tab was used while it loaded.
 */
export async function openTour(): Promise<boolean> {
  const tab = createTab()
  const blank = tab.store.graph
  try {
    return await openDemoDocument(tab.store)
  } catch (error) {
    if (untouched(tab.store, blank)) {
      // A failure to close the tab is its own problem; the tour's failure is what to report.
      await closeTab(tab.id, 'discard').catch((cleanup: unknown) => {
        console.error('[Tour] Could not close the tab of a tour that failed to load:', cleanup)
      })
    }
    throw error
  }
}

/** Open the tour from a menu, where nothing stays on screen to show a failure but a toast. */
export function openTourFromMenu(): void {
  openTour().catch((error: unknown) => {
    console.error('[Tour] Could not open the tour:', error)
    const detail = error instanceof Error ? error.message : String(error)
    toast.error(notificationMessages.get().openTourFailed({ error: detail }))
  })
}
