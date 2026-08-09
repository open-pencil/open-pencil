import { watchDebounced } from '@vueuse/core'

import type { EditorState } from '@open-pencil/core/editor'

type AutosaveState = EditorState & { autosaveEnabled: boolean }

type AutosaveOptions = {
  state: AutosaveState
  getSavedVersion: () => number
  hasWritableSource: () => boolean
  saveCurrentDocument: () => Promise<void>
}

export function createAutosave({
  state,
  getSavedVersion,
  hasWritableSource,
  saveCurrentDocument
}: AutosaveOptions) {
  async function saveIfDirty(): Promise<boolean> {
    if (state.sceneVersion === getSavedVersion()) return false
    if (!state.autosaveEnabled) return false
    if (!hasWritableSource()) return false
    await saveCurrentDocument()
    return true
  }

  const stop = watchDebounced(
    () => state.sceneVersion,
    async () => {
      try {
        await saveIfDirty()
      } catch (e) {
        console.warn('Autosave failed:', e)
      }
    },
    { debounce: 3000 }
  )

  /**
   * Save pending edits now instead of waiting out the debounce. Leaving the
   * editor for the workspace must not show a stale thumbnail of a document
   * whose colour change never made it to disk. A debounced callback that fires
   * afterwards finds the versions equal and does nothing.
   */
  async function flushAutosave(): Promise<void> {
    try {
      await saveIfDirty()
    } catch (e) {
      console.warn('Autosave failed:', e)
    }
  }

  return { disposeAutosave: stop, flushAutosave }
}
