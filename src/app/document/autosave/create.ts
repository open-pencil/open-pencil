import { watchDebounced } from '@vueuse/core'

import type { EditorState } from '@open-pencil/core/editor'

type AutosaveState = EditorState & { autosaveEnabled: boolean }

type AutosaveOptions = {
  state: AutosaveState
  getSavedVersion: () => number
  hasWritableSource: () => boolean
  saveCurrentDocument: (version: number) => Promise<void>
}

export function createAutosave({
  state,
  getSavedVersion,
  hasWritableSource,
  saveCurrentDocument
}: AutosaveOptions) {
  let requestedVersion: number | null = null
  let saving: Promise<void> | null = null
  let disposed = false

  function canSave(version: number) {
    return version > getSavedVersion() && state.autosaveEnabled && hasWritableSource()
  }

  async function runSaves() {
    while (requestedVersion !== null) {
      if (disposed) return
      const version = requestedVersion
      requestedVersion = null
      if (!canSave(version)) continue
      await saveCurrentDocument(version)
    }
  }

  function reportFailure(error: unknown) {
    console.warn('Autosave failed:', error)
  }

  function requestSave(version: number): Promise<void> {
    if (disposed || !canSave(version)) return Promise.resolve()
    requestedVersion = Math.max(requestedVersion ?? version, version)
    if (!saving) {
      saving = runSaves().finally(() => {
        saving = null
        if (!disposed && requestedVersion !== null) {
          void requestSave(requestedVersion).catch(reportFailure)
        }
      })
    }
    return saving
  }

  const stop = watchDebounced(
    () => state.sceneVersion,
    (version) => {
      void requestSave(version).catch(reportFailure)
    },
    { debounce: 3000 }
  )

  return {
    requestSave,
    disposeAutosave() {
      disposed = true
      requestedVersion = null
      stop()
    }
  }
}
