import { watchDebounced } from '@vueuse/core'
import { watch } from 'vue'

/** How long after the last edit a document saves. */
const EDIT_SAVE_DELAY_MS = 3_000
/**
 * How often a document whose room keeps its edits saves a checkpoint, and the longest any edit
 * waits for a save while editing goes on.
 */
const CHECKPOINT_INTERVAL_MS = 60_000

type AutosaveOptions = {
  state: { autosaveEnabled: boolean; roomKeepsEdits: boolean }
  /** The document's content revision; rendering and layout do not advance it. */
  version: () => number
  getSavedVersion: () => number
  hasWritableSource: () => boolean
  saveCurrentDocument: (version: number) => Promise<void>
  /** An automatic save failed; nobody is waiting on it to say so. */
  onFailed?: (error: unknown) => void
  /** An automatic save finished. */
  onSaved?: () => void
}

export function createAutosave({
  state,
  version: currentVersion,
  getSavedVersion,
  hasWritableSource,
  saveCurrentDocument,
  onFailed,
  onSaved
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
      onSaved?.()
    }
  }

  function reportFailure(error: unknown) {
    console.warn('Autosave failed:', error)
    if (!disposed) onFailed?.(error)
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
    {
      debounce: () => (state.roomKeepsEdits ? CHECKPOINT_INTERVAL_MS : EDIT_SAVE_DELAY_MS),
      maxWait: CHECKPOINT_INTERVAL_MS
    }
  )
  // Edits waiting for a checkpoint are the tab's alone once the room stops keeping them.
  const stopKept = watch(
    () => state.roomKeepsEdits,
    (kept) => {
      if (!kept) void requestSave(currentVersion()).catch(reportFailure)
    }
  )

  return {
    requestSave,
    /** Saves the document as it is now, as an edit would, reporting a failure the same way. */
    retry() {
      void requestSave(currentVersion()).catch(reportFailure)
    },
    disposeAutosave() {
      disposed = true
      requestedVersion = null
      stop()
      stopKept()
    }
  }
}
