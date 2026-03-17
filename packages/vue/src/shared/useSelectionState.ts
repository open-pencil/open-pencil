import { computed } from 'vue'

import { useEditor } from '../shared/editorContext'
import { useSceneComputed } from './useSceneComputed'

import type { SceneNode } from '@open-pencil/core'

export function useSelectionState() {
  const editor = useEditor()

  const selectedIds = useSceneComputed(() => editor.state.selectedIds)

  const hasSelection = computed(() => selectedIds.value.size > 0)

  const selectedNode = useSceneComputed<SceneNode | null>(
    () => editor.getSelectedNode() ?? null
  )

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
