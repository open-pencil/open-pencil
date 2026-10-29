import { tryOnScopeDispose, watchImmediate } from '@vueuse/core'
import { computed, shallowReactive, shallowRef } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useRetainedActivity } from '#vue/lifecycle/retention/context'

export interface SelectedNodeState {
  nodes: ComputedRef<SceneNode[]>
  node: ComputedRef<SceneNode | null>
  dispose: () => void
}

/**
 * The selected layers as the panel shows them: text being edited has the style of its selected
 * characters, which the panel then edits.
 */
export function selectedNodesAsShown(editor: Editor): SceneNode[] {
  if (editor.state.editingTextId) void editor.state.textSelectionVersion
  return editor.getSelectedNodes().map((node) => {
    const style = editor.getTextSelectionStyle(node)
    return style ? { ...node, ...style } : node
  })
}

/** Selected-node copies with property-level preview tracking; never proxies the graph. */
export function createSelectedNodeState(
  editor: Editor,
  active?: Readonly<Ref<boolean>>
): SelectedNodeState {
  const revision = shallowRef(0)
  const refresh = () => {
    revision.value++
  }
  const refreshSelected = (id: string) => {
    if (editor.state.selectedIds.has(id)) refresh()
  }
  const nodes = computed<SceneNode[]>((previous) => {
    if (active?.value === false && previous) return previous
    void revision.value
    void editor.state.sceneVersion
    void editor.state.currentPageId
    return selectedNodesAsShown(editor).map((node) => shallowReactive(structuredClone(node)))
  })
  const byId = computed(() => new Map(nodes.value.map((node) => [node.id, node])))
  const node = computed(() => (nodes.value.length === 1 ? nodes.value[0] : null))

  function updatePreview(id: string, changes: Partial<SceneNode>) {
    if (!editor.state.selectedIds.has(id)) return
    const selected = byId.value.get(id)
    if (selected) Object.assign(selected, structuredClone(changes))
  }

  const dispose = watchImmediate(
    () => active?.value ?? true,
    (enabled, _previous, onCleanup) => {
      if (!enabled) return
      refresh()
      onCleanup(editor.onEditorEvent('node:previewUpdated', updatePreview))
      onCleanup(editor.onEditorEvent('node:updated', refreshSelected))
      onCleanup(editor.onEditorEvent('selection:changed', refresh))
      onCleanup(editor.onEditorEvent('graph:replaced', refresh))
      onCleanup(editor.onEditorEvent('page:changed', refresh))
      onCleanup(editor.onEditorEvent('node:created', refresh))
      onCleanup(editor.onEditorEvent('node:deleted', refresh))
      onCleanup(editor.onEditorEvent('node:reparented', refresh))
      onCleanup(editor.onEditorEvent('node:reordered', refresh))
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
