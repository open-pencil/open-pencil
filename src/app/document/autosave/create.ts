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
}

export function createAutosave({
  state,
  version: currentVersion,
  getSavedVersion,
  hasWritableSource,
  saveCurrentDocument,
  onFailed
}: AutosaveOptions) {
  let requestedVersion: number | null = null
  let saving: Promise<void> | null = null
  let disposed = false
  // The writes whose failure is already reported: edits that join a running write share it.
  const reported = new WeakSet<Promise<void>>()

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
    if (!disposed) onFailed?.(error)
  }

  /** Saves `version` with nobody waiting on it, so a failure is reported once per write. */
  function saveInBackground(version: number) {
    const write = requestSave(version)
    if (reported.has(write)) return
    reported.add(write)
    void write.catch(reportFailure)
  }

  function requestSave(version: number): Promise<void> {
    if (disposed || !canSave(version)) return Promise.resolve()
    requestedVersion = Math.max(requestedVersion ?? version, version)
    if (!saving) {
      saving = runSaves().finally(() => {
        saving = null
        if (!disposed && requestedVersion !== null) {
          saveInBackground(requestedVersion)
        }
      })
    }
    return saving
  }

  const stop = watchDebounced(
    currentVersion,
    (version) => {
      saveInBackground(version)
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
      if (!kept) saveInBackground(currentVersion())
    }
  )

  return {
    requestSave,
    disposeAutosave() {
      disposed = true
      requestedVersion = null
      stop()
      stopKept()
    }
  }
}
