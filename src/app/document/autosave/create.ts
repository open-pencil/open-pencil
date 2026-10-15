import { watchDebounced } from '@vueuse/core'

type AutosaveOptions = {
  state: { autosaveEnabled: boolean }
  /** The document's content revision; rendering and layout do not advance it. */
  version: () => number
  getSavedVersion: () => number
  hasWritableSource: () => boolean
  saveCurrentDocument: (version: number) => Promise<void>
}

export function createAutosave({
  state,
  version: currentVersion,
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
    currentVersion,
    (version) => {
      void requestSave(version).catch(reportFailure)
    },
    // Soon after an edit, and regularly during a long one: the library is where designs live.
    { debounce: 1000, maxWait: 5000 }
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
