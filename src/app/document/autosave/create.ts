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
  const stop = watchDebounced(
    () => state.sceneVersion,
    async (version) => {
      if (version === getSavedVersion()) return
      if (!state.autosaveEnabled) return
      if (!hasWritableSource()) return
      try {
        await saveCurrentDocument()
      } catch (e) {
        console.warn('Autosave failed:', e)
      }
    },
    { debounce: 3000 }
  )

  return { disposeAutosave: stop }
}
