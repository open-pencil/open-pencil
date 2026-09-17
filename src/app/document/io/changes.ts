import { computed, ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

/** Content-only revisions: viewport repainting and recovery never mark a document saved. */
export function createDocumentChanges(editor: Editor) {
  const revision = ref(0)
  const savedRevision = ref(0)
  const dirty = computed(() => revision.value !== savedRevision.value)
  const changed = () => {
    revision.value++
  }
  const unsubscribers = [
    editor.onEditorEvent('node:created', changed),
    editor.onEditorEvent('node:updated', changed),
    editor.onEditorEvent('node:deleted', changed),
    editor.onEditorEvent('node:reparented', changed),
    editor.onEditorEvent('node:reordered', changed),
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
