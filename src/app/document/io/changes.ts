import { computed, ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

/**
 * Content-only revisions: viewport repainting, layout, loading a page's layers, and recovery
 * never mark a document changed or saved. Autosave and recovery follow the same revision.
 */
export function createDocumentChanges(editor: Editor) {
  const revision = ref(0)
  const savedRevision = ref(0)
  const dirty = computed(() => revision.value !== savedRevision.value)
  const changed = () => {
    revision.value++
  }
  // A page's layers load from the opened file when it is first shown; they are the document
  // as saved, not an edit.
  const contentChanged = () => {
    if (!editor.graph.isApplyingImportedState) changed()
  }
  // Layout derives sizes and positions from the document; opening a page or loading a font
  // relays it out without an edit, and an edit that relays it out has already counted.
  const updated = () => {
    if (!editor.graph.isApplyingLayout) contentChanged()
  }
  const unsubscribers = [
    editor.onEditorEvent('node:created', contentChanged),
    editor.onEditorEvent('node:updated', updated),
    editor.onEditorEvent('node:deleted', contentChanged),
    editor.onEditorEvent('node:reparented', contentChanged),
    editor.onEditorEvent('node:reordered', contentChanged),
    editor.onEditorEvent('graph:replaced', changed),
    editor.onEditorEvent('history:changed', changed)
  ]
  return {
    hasUnsavedChanges: () => dirty.value,
    capture: () => revision.value,
    markSaved: (version = revision.value) => {
      savedRevision.value = version
    },
    markChanged: changed,
    dispose: () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }
}
