import { computed, ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { UndoEntry } from '@open-pencil/scene-graph/undo'

/** Stands for the history of a save whose state was not captured, which history never returns to. */
const UNKNOWN_HISTORY: UndoEntry = { label: '', forward: () => undefined, inverse: () => undefined }

/**
 * Content-only revisions: viewport repainting, layout, loading a page's layers, and recovery
 * never mark a document changed or saved. Autosave and recovery follow the same revision.
 *
 * Instances following their components after an edit or an undo are that change's results, not
 * edits of their own.
 *
 * A document whose history goes back to where it was saved, by undo or redo, is saved again,
 * unless something changed it outside the history since, such as a collaborator. An editor edit
 * records its step in the same task as the change, or, while text is being edited or an edit is
 * being coalesced, such as a picker drag, when that edit ends. A change no step follows within
 * its task, with neither of those open, is one made outside the history; one an open edit makes
 * waits for that edit's step. A change applied outside edits (`SceneGraph.runOutsideEdits`), such
 * as a collaborator's, is outside the history at once, even while an edit is open. An edit or batch that ends without one, rolled back, cancelled, or
 * changing nothing, undid what it changed, so the document is as the history says once no other
 * edit is still open.
 */
export function createDocumentChanges(editor: Editor) {
  const revision = ref(0)
  const savedRevision = ref(0)
  /** The revision of the last change to the history, which accounts for the changes before it. */
  let historyRevision = 0
  /** The last edit or batch that ended without a step, undoing what it changed. */
  let discardRevision = 0
  /** The last content change, and the last one no history change accounted for. */
  let contentRevision = 0
  let outsideRevision = 0
  /** The last change typed into text being edited, which only the text edit's own step settles. */
  let typingRevision = 0
  let savedHistory: UndoEntry | undefined = editor.undo.peekUndo()
  /**
   * The history at each captured revision, for a save that finishes after later edits, with how
   * many saves in progress hold it.
   */
  const capturedHistory = new Map<number, { history: UndoEntry | undefined; saves: number }>()
  /** How many changes the document already had elsewhere are being applied. */
  let adopting = 0

  const dirty = computed(() => {
    if (revision.value === savedRevision.value) return false
    const saved = savedRevision.value
    if (outsideRevision > saved) return true
    if (typingRevision > Math.max(historyRevision, saved)) return true
    if (contentRevision > Math.max(historyRevision, discardRevision, saved)) return true
    return editor.undo.peekUndo() !== savedHistory
  })

  const changed = () => {
    revision.value++
    outsideRevision = revision.value
  }
  const contentChanged = () => {
    if (editor.graph.isApplyingImportedState || editor.isSyncingComponents() || adopting > 0) {
      return
    }
    revision.value++
    contentRevision = revision.value
    const at = contentRevision
    if (editor.graph.isWritingOutsideEdits && !editor.undo.isReplaying) {
      outsideRevision = at
      return
    }
    // Text editing, coalesced edits, and edits that await record their step when they end.
    if (editor.undo.isRecording) return
    if (editor.state.editingTextId !== null) {
      typingRevision = at
      return
    }
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
  // An edit still open, such as an agent's call while the user cancels a drag, has changes no
  // step accounts for yet; its own step, or its own discard, settles them. A discard settles only
  // changes made inside edits: one made outside them still waits for its task's step, if any,
  // and text being typed waits for the text edit's step.
  const editDiscarded = () => {
    if (editor.undo.isRecording) return
    revision.value++
    discardRevision = revision.value
  }
  const unsubscribers = [
    editor.onEditorEvent('node:created', contentChanged),
    editor.onEditorEvent('node:updated', updated),
    editor.onEditorEvent('node:deleted', contentChanged),
    editor.onEditorEvent('node:reparented', contentChanged),
    editor.onEditorEvent('node:reordered', contentChanged),
    editor.onEditorEvent('graph:replaced', changed),
    editor.onEditorEvent('history:changed', historyChanged),
    editor.onEditorEvent('edit:discarded', editDiscarded)
  ]

  /**
   * The current revision with the history at it, for a save that marks it saved when it finishes.
   * A check that only compares revisions uses `revision`: the step kept here stays alive until a
   * save settles it, past the history limit.
   */
  function capture() {
    const captured = capturedHistory.get(revision.value)
    if (captured) captured.saves++
    else capturedHistory.set(revision.value, { history: editor.undo.peekUndo(), saves: 1 })
    return revision.value
  }

  return {
    hasUnsavedChanges: () => dirty.value,
    revision: () => revision.value,
    capture,
    markSaved: (version = capture()) => {
      const captured = capturedHistory.get(version)
      savedHistory = captured ? captured.history : UNKNOWN_HISTORY
      // A later save still in progress, such as a manual save overlapping an autosave, keeps its own.
      for (const captured of capturedHistory.keys()) {
        if (captured <= version) capturedHistory.delete(captured)
      }
      savedRevision.value = version
    },
    /** Lets go of a save's capture when the save failed or was cancelled, so it keeps no step. */
    release: (version: number) => {
      const captured = capturedHistory.get(version)
      if (captured && --captured.saves === 0) capturedHistory.delete(version)
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
