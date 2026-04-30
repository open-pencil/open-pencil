import { useDebounceFn } from '@vueuse/core'
import { watch } from 'vue'

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
  const debouncedAutosave = useDebounceFn(async () => {
    if (state.sceneVersion === getSavedVersion()) return
    if (!state.autosaveEnabled) return
    try {
      await saveCurrentDocument()
    } catch (e) {
      console.warn('Autosave failed:', e)
    }
  }, 3000)

  watch(
    () => state.sceneVersion,
    (version) => {
      if (version === getSavedVersion()) return
      if (!state.autosaveEnabled) return
      if (!hasWritableSource()) return
      void debouncedAutosave()
    }
  )

  function disposeAutosave() {
    ;(debouncedAutosave as typeof debouncedAutosave & { cancel?: () => void }).cancel?.()
  }

  return { disposeAutosave }
}
