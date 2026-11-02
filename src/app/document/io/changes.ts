import { computed, ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { UndoEntry } from '@open-pencil/scene-graph/undo'

/** Stands for the history of a save whose state was not captured, which history never returns to. */
const UNKNOWN_HISTORY: UndoEntry = { label: '', forward: () => undefined, inverse: () => undefined }

/**
 * Content-only revisions: viewport repainting, layout, loading a page's layers, and recovery
 * never mark a document changed or saved. Autosave and recovery follow the same revision.
 *
 * A document whose history goes back to where it was saved, by undo or redo, is saved again,
 * unless something changed it outside the history since, such as a collaborator. An editor edit
 * records its step in the same task as the change, or, while text is being edited or an edit is
 * being coalesced, such as a picker drag, when that edit ends. A change no step follows within
 * its task, with neither of those open, is one made outside the history; one an open edit makes
 * waits for that edit's step, and keeps the document unsaved if the edit records none.
 */
export function createDocumentChanges(editor: Editor) {
  const revision = ref(0)
  const savedRevision = ref(0)
  /** The revision of the last change to the history, which accounts for the changes before it. */
  let historyRevision = 0
  /** The last content change, and the last one no history change accounted for. */
  let contentRevision = 0
  let outsideRevision = 0
  let savedHistory: UndoEntry | undefined = editor.undo.peekUndo()
  /** The history at each captured revision, for a save that finishes after later edits. */
  const capturedHistory = new Map<number, UndoEntry | undefined>()
  /** How many changes the document already had elsewhere are being applied. */
  let adopting = 0

  const dirty = computed(() => {
    if (revision.value === savedRevision.value) return false
    const saved = savedRevision.value
    if (outsideRevision > saved) return true
    if (contentRevision > Math.max(historyRevision, saved)) return true
    return editor.undo.peekUndo() !== savedHistory
  })

  const changed = () => {
    revision.value++
    outsideRevision = revision.value
  }
  const contentChanged = () => {
    if (editor.graph.isApplyingImportedState || adopting > 0) return
    revision.value++
    contentRevision = revision.value
    const at = contentRevision
    // Text editing, coalesced edits, and edits that await record their step when they end.
    if (editor.state.editingTextId !== null || editor.undo.isRecording) return
    queueMicrotask(() => {
      if (historyRevision < at) outsideRevision = Math.max(outsideRevision, at)
    })
  }
  // Layout derives sizes and positions from the document; opening a page or loading a font
  // relays it out without an edit, and an edit that relays it out has already counted.
  const updated = () => {
    if (!editor.graph.isApplyingLayout) contentChanged()
  }
  const historyChanged = () => {
    revision.value++
    historyRevision = revision.value
  }
  const unsubscribers = [
    editor.onEditorEvent('node:created', contentChanged),
    editor.onEditorEvent('node:updated', updated),
    editor.onEditorEvent('node:deleted', contentChanged),
    editor.onEditorEvent('node:reparented', contentChanged),
    editor.onEditorEvent('node:reordered', contentChanged),
    editor.onEditorEvent('graph:replaced', changed),
    editor.onEditorEvent('history:changed', historyChanged)
  ]

  function capture() {
    capturedHistory.set(revision.value, editor.undo.peekUndo())
    return revision.value
  }

  return {
    hasUnsavedChanges: () => dirty.value,
    capture,
    markSaved: (version = capture()) => {
      savedHistory = capturedHistory.has(version) ? capturedHistory.get(version) : UNKNOWN_HISTORY
      // A later save still in progress, such as a manual save overlapping an autosave, keeps its own.
      for (const captured of capturedHistory.keys()) {
        if (captured <= version) capturedHistory.delete(captured)
      }
      savedRevision.value = version
    },
    markChanged: changed,
    /** Applies changes the document already has elsewhere, such as its room's, as no edit. */
    adopt: <T>(apply: () => T): T => {
      adopting++
      try {
        return apply()
      } finally {
        adopting--
      }
    },
    dispose: () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }
}
