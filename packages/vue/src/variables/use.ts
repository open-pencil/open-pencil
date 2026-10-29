import { ref, computed, watch } from 'vue'

import type { Variable } from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'
import { fuzzyFilter } from '#vue/shared/search/fuzzy'
import { createVariableCollectionActions, createVariableValueActions } from '#vue/variables/helpers'

export function useVariables() {
  const editor = useEditor()
  const searchTerm = ref('')

  function setSearchTerm(term: string) {
    searchTerm.value = term
  }

  /**
   * Snapshots, not the graph's own objects: the editor edits collections in place, so a component
   * given the same object again would not see a mode added, renamed, or given a condition.
   */
  const collections = useSceneComputed(() =>
    editor.getCollections().map((collection) => structuredClone(collection))
  )

  const activeCollectionId = ref(collections.value[0]?.id ?? '')
  watch(collections, (cols) => {
    if (!activeCollectionId.value && cols[0]) activeCollectionId.value = cols[0].id
  })

  const activeCollection = computed(
    () => collections.value.find((collection) => collection.id === activeCollectionId.value) ?? null
  )
  const activeModes = computed(() => activeCollection.value?.modes ?? [])

  const variables = useSceneComputed(() => {
    if (!activeCollectionId.value) return [] as Variable[]
    const all = editor
      .getVariablesForCollection(activeCollectionId.value)
      .map((variable) => structuredClone(variable))
    return fuzzyFilter(all, ['name', 'description'], searchTerm.value)
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
