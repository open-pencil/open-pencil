import { computed } from 'vue'

import { useEditor } from '../context'

import type { SceneNode } from '@open-pencil/core'

export function useSelectionState() {
  const editor = useEditor()

  const selectedIds = computed(() => {
    void editor.state.sceneVersion
    return editor.state.selectedIds
  })

  const hasSelection = computed(() => selectedIds.value.size > 0)

  const selectedNode = computed<SceneNode | null>(() => {
    void editor.state.sceneVersion
    return editor.getSelectedNode() ?? null
  })

  const selectedCount = computed(() => selectedIds.value.size)

  const selectedNodeType = computed(() => selectedNode.value?.type ?? null)

  const isInstance = computed(() => selectedNodeType.value === 'INSTANCE')
  const isComponent = computed(() => selectedNodeType.value === 'COMPONENT')
  const isGroup = computed(() => selectedNodeType.value === 'GROUP')

  const canCreateComponentSet = computed(() => {
    if (selectedIds.value.size < 2) return false
    for (const id of selectedIds.value) {
      if (editor.graph.getNode(id)?.type !== 'COMPONENT') return false
    }
    return true
  })

  return {
    editor,
    selectedIds,
    hasSelection,
    selectedNode,
    selectedCount,
    selectedNodeType,
    isInstance,
    isComponent,
    isGroup,
    canCreateComponentSet
  }
}
