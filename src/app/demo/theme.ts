import { watch, type WatchSource } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { Color } from '@open-pencil/scene-graph/primitives'

type AppTheme = 'dark' | 'light'
type TourThemeEditor = Pick<
  Editor,
  'graph' | 'setActiveMode' | 'setPageColor' | 'onEditorEvent' | 'requestRender'
>

/**
 * The tour's contract with `tools/generate/demo/src/document/theme.ts`: collections by these
 * names have a Dark and a Light mode, and the Theme collection's Page color is the page
 * background in each.
 */
const TOUR_COLLECTIONS = ['Theme', 'App chrome'] as const
const MODE_NAMES: Record<AppTheme, string> = { dark: 'Dark', light: 'Light' }
const PAGE_COLOR = 'Page'

function isColor(value: unknown): value is Color {
  return typeof value === 'object' && value !== null && 'r' in value && 'a' in value
}

/**
 * Show the tour in the app's theme: each tour collection reads its mode of that name wherever a
 * layer does not pin one, and the page takes the Page color. Neither is an edit, so the tour
 * opens with nothing to save.
 */
export function applyTourTheme(editor: TourThemeEditor, theme: AppTheme): void {
  const { graph } = editor
  graph.applyImportedStateDuring(() => {
    for (const collection of graph.variableCollections.values()) {
      if (!TOUR_COLLECTIONS.some((name) => name === collection.name)) continue
      const mode = collection.modes.find((candidate) => candidate.name === MODE_NAMES[theme])
      if (!mode) continue
      editor.setActiveMode(collection.id, mode.modeId)
      if (collection.name !== TOUR_COLLECTIONS[0]) continue
      const page = collection.variableIds
        .map((id) => graph.variables.get(id))
        .find((variable) => variable?.name === PAGE_COLOR)
      const color = page && graph.resolveVariable(page.id, mode.modeId)
      if (isColor(color)) editor.setPageColor(color)
    }
  })
  editor.requestRender()
}

/**
 * Keep the tour in the app's theme while it is open: now, and whenever the theme changes,
 * until the tab shows another document. Returns a function that stops following.
 */
export function followAppTheme(editor: TourThemeEditor, theme: WatchSource<AppTheme>) {
  const stopWatching = watch(theme, (value) => applyTourTheme(editor, value), { immediate: true })
  const stopListening = editor.onEditorEvent('graph:replaced', stop)
  function stop() {
    stopWatching()
    stopListening()
  }
  return stop
}
