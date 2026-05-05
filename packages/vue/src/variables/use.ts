import { ref, computed, watch } from 'vue'

import type { Variable } from '@open-pencil/core/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'
import { createVariableCollectionActions, createVariableValueActions } from '#vue/variables/helpers'

export function useVariables() {
  const editor = useEditor()
  const searchTerm = ref('')

  function setSearchTerm(term: string) {
    searchTerm.value = term
  }

  const collections = useSceneComputed(() => editor.getCollections())

  const activeCollectionId = ref(collections.value[0]?.id ?? '')
  watch(collections, (cols) => {
    if (!activeCollectionId.value && cols[0]) activeCollectionId.value = cols[0].id
  })

  const activeCollection = computed(() => editor.getCollection(activeCollectionId.value) ?? null)
  const activeModes = computed(() => activeCollection.value?.modes ?? [])

  const variables = useSceneComputed(() => {
    if (!activeCollectionId.value) return [] as Variable[]
    const all = editor.getVariablesForCollection(activeCollectionId.value)
    if (!searchTerm.value) return all
    const q = searchTerm.value.toLowerCase()
    return all.filter((v) => v.name.toLowerCase().includes(q))
  })

  const collectionActions = createVariableCollectionActions(editor, activeCollectionId)
  const variableActions = createVariableValueActions(editor, () => activeCollection.value)

  return {
    editor,
    collections,
    activeCollectionId,
    activeCollection,
    activeModes,
    variables,
    searchTerm,
    setSearchTerm,
    ...collectionActions,
    ...variableActions
  }
}
