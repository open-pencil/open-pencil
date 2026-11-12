import { onScopeDispose, watchEffect, type Ref } from 'vue'

import type { BlurRampEdit } from '@open-pencil/core'

import { useEditorStore } from '@/app/editor/active-store'

/**
 * Shows the canvas handles of the progressive blur whose settings are open, as Figma desktop 126
 * does while its blur popover is open: only for a single layer, and gone when the settings close.
 */
export function useBlurRampEditing(expandedIndex: Ref<number | null>) {
  const store = useEditorStore()

  function editedTarget(): BlurRampEdit | null {
    const index = expandedIndex.value
    const ids = [...store.state.selectedIds]
    const [nodeId] = ids
    if (index === null || ids.length !== 1 || !nodeId) return null
    // The layer's effects change through the graph, which the scene version tracks.
    void store.state.sceneVersion
    return store.graph.getNode(nodeId)?.effects.at(index)?.progressive ? { nodeId, index } : null
  }

  function show(edit: BlurRampEdit | null) {
    const current = store.state.blurRampEdit
    if (current?.nodeId === edit?.nodeId && current?.index === edit?.index) return
    store.state.blurRampEdit = edit
    store.requestRepaint()
  }

  watchEffect(() => show(editedTarget()))
  onScopeDispose(() => show(null))
}
