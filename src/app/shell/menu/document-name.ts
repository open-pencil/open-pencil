import { computed } from 'vue'

import { useInlineRename } from '@open-pencil/vue'

import type { EditorStore } from '@/app/editor/active-store'

const DOCUMENT_NAME_ID = 'document-name'

export function useDocumentNameRename(store: EditorStore) {
  const rename = useInlineRename<'document-name'>((_id, name) => {
    store.state.documentName = name
  })
  const editingName = computed(() => rename.editingId.value === DOCUMENT_NAME_ID)

  function startRename() {
    rename.start(DOCUMENT_NAME_ID, store.state.documentName)
  }

  function commitRename(input: HTMLInputElement) {
    rename.commit(DOCUMENT_NAME_ID, input)
  }

  return { rename, editingName, startRename, commitRename }
}
