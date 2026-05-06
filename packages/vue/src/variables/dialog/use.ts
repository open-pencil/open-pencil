import { nextTick, ref } from 'vue'

import { useVariables } from '#vue/variables/use'

export function useVariablesDialogState() {
  const variables = useVariables()

  const editingCollectionId = ref<string | null>(null)
  const editingModeId = ref<string | null>(null)
  async function focusCollectionInput(input: HTMLInputElement | null) {
    if (!input) return
    await nextTick()
    input.focus()
    input.select()
  }

  function startRenameCollection(id: string) {
    editingCollectionId.value = id
  }

  function commitRenameCollection(id: string, event: Event) {
    if (editingCollectionId.value !== id) return
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    const value = input.value.trim()
    const col = variables.collections.value.find((collection) => collection.id === id)
    if (col && value && value !== col.name) {
      variables.renameCollection(id, value)
    }
    editingCollectionId.value = null
  }

  function startRenameMode(modeId: string) {
    editingModeId.value = modeId
  }

  async function focusModeInput(input: HTMLInputElement | null) {
    if (!input) return
    await nextTick()
    input.focus()
    input.select()
  }

  function commitRenameMode(modeId: string, event: Event) {
    if (editingModeId.value !== modeId) return
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    const value = input.value.trim()
    const mode = variables.activeModes.value.find((m) => m.modeId === modeId)
    if (mode && value && value !== mode.name) {
      variables.renameMode(modeId, value)
    }
    editingModeId.value = null
  }

  return {
    ...variables,
    editingCollectionId,
    editingModeId,
    focusCollectionInput,
    focusModeInput,
    startRenameCollection,
    commitRenameCollection,
    startRenameMode,
    commitRenameMode
  }
}
