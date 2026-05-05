import { nextTick, ref } from 'vue'

import { useVariables } from '#vue/variables/use'

export function useVariablesDialogState() {
  const variables = useVariables()

  const editingCollectionId = ref<string | null>(null)
  async function focusCollectionInput(input: HTMLInputElement | null) {
    if (!input) return
    await nextTick()
    input.focus()
    input.select()
  }

  function startRenameCollection(id: string) {
    editingCollectionId.value = id
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
    focusCollectionInput,
    startRenameCollection,
    commitRenameCollection
  }
}
