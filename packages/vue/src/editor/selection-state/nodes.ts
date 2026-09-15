import { tryOnScopeDispose, watchImmediate } from '@vueuse/core'
import { computed, shallowReactive } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useRetainedActivity } from '#vue/lifecycle/retention/context'

export interface SelectedNodeState {
  nodes: ComputedRef<SceneNode[]>
  node: ComputedRef<SceneNode | null>
  dispose: () => void
}

/** Selected-node copies with property-level preview tracking; never proxies the graph. */
export function createSelectedNodeState(
  editor: Editor,
  active?: Readonly<Ref<boolean>>
): SelectedNodeState {
  const nodes = computed<SceneNode[]>((previous) => {
    if (active?.value === false && previous) return previous
    void editor.state.sceneVersion
    void editor.state.currentPageId
    return editor.getSelectedNodes().map((node) => shallowReactive(node))
  })
  const byId = computed(() => new Map(nodes.value.map((node) => [node.id, node])))
  const node = computed(() => (nodes.value.length === 1 ? nodes.value[0] : null))

  function updatePreview(id: string, changes: Partial<SceneNode>) {
    if (!editor.state.selectedIds.has(id)) return
    const selected = byId.value.get(id)
    if (selected) Object.assign(selected, changes)
  }

  const dispose = watchImmediate(
    () => active?.value ?? true,
    (enabled, _previous, onCleanup) => {
      if (!enabled) return
      onCleanup(editor.onEditorEvent('node:previewUpdated', updatePreview))
    },
    { flush: 'sync' }
  )
  return { nodes, node, dispose }
}

export function useSelectedNodeState(editor = useEditor()): SelectedNodeState {
  const state = createSelectedNodeState(editor, useRetainedActivity())
  tryOnScopeDispose(state.dispose)
  return state
}
