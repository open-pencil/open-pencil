import { nextTick, ref } from 'vue'

import { useVariables } from './useVariables'

export function useVariablesDialogState() {
  const variables = useVariables()

  const editingCollectionId = ref<string | null>(null)
  const collectionInputRefs = new Map<string, HTMLInputElement>()
  const pendingCollectionFocusId = ref<string | null>(null)

  function setCollectionInputRef(id: string, el: HTMLInputElement | null) {
    if (el) collectionInputRefs.set(id, el)
    else collectionInputRefs.delete(id)

    if (el && pendingCollectionFocusId.value === id) {
      pendingCollectionFocusId.value = null
      void nextTick(() => {
        el.focus()
        el.select()
      })
    }
  }

  function startRenameCollection(id: string) {
    editingCollectionId.value = id
    pendingCollectionFocusId.value = id
  }

  function commitRenameCollection(id: string, input: HTMLInputElement) {
    if (editingCollectionId.value !== id) return
    const value = input.value.trim()
    const col = variables.collections.value.find((collection) => collection.id === id)
    if (col && value && value !== col.name) {
      variables.renameCollection(id, value)
    }
    editingCollectionId.value = null
  }

  return {
    ...variables,
    editingCollectionId,
    setCollectionInputRef,
    startRenameCollection,
    commitRenameCollection
  }
}
