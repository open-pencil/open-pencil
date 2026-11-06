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

function selectedNodeAsShown(editor: Editor, node: SceneNode): SceneNode {
  const style = editor.getTextSelectionStyle(node)
  return style ? { ...node, ...style } : node
}

/**
 * The selected layers as the panel shows them: text has the style of its first character, or of
 * its selected characters while it is edited, which the panel then edits.
 */
export function selectedNodesAsShown(editor: Editor): SceneNode[] {
  if (editor.state.editingTextId) void editor.state.textSelectionVersion
  return editor.getSelectedNodes().map((node) => selectedNodeAsShown(editor, node))
}

/** Selected-node copies with property-level preview tracking; never proxies the graph. */
export function createSelectedNodeState(
  editor: Editor,
  active?: Readonly<Ref<boolean>>
): SelectedNodeState {
  const revision = shallowRef(0)
  const projections = new Map<string, SceneNode>()
  const dirty = new Set<string>()
  let textStyleVersion = -1
  const invalidateAll = () => {
    projections.clear()
    dirty.clear()
    revision.value++
  }
  /** Rebuilds only the changed selected layers, keeping the other projections and their readers. */
  const refreshAfterEdit = (id: string) => {
    if (active?.value === false || !editor.state.selectedIds.has(id)) return
    dirty.add(id)
    revision.value++
  }
  const nodes = computed<SceneNode[]>((previous) => {
    if (active?.value === false && previous) return previous
    void revision.value
    void editor.state.currentPageId
    const ids = [...editor.state.selectedIds]
    if (editor.state.editingTextId && editor.state.textSelectionVersion !== textStyleVersion) {
      textStyleVersion = editor.state.textSelectionVersion
      for (const id of ids) dirty.add(id)
    }
    for (const id of projections.keys())
      if (!editor.state.selectedIds.has(id)) projections.delete(id)
    return ids.flatMap((id) => {
      const source = editor.graph.getNode(id)
      if (!source) {
        projections.delete(id)
        return []
      }
      let projection = projections.get(id)
      if (!projection || dirty.has(id)) {
        projection = shallowReactive(structuredClone(selectedNodeAsShown(editor, source)))
        projections.set(id, projection)
        dirty.delete(id)
      }
      return [projection]
    })
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
      invalidateAll()
      onCleanup(editor.onEditorEvent('node:previewUpdated', updatePreview))
      onCleanup(editor.onEditorEvent('node:updated', refreshAfterEdit))
      onCleanup(editor.onEditorEvent('selection:changed', invalidateAll))
      onCleanup(editor.onEditorEvent('graph:replaced', invalidateAll))
      onCleanup(editor.onEditorEvent('page:changed', invalidateAll))
      onCleanup(editor.onEditorEvent('node:created', invalidateAll))
      onCleanup(editor.onEditorEvent('node:deleted', invalidateAll))
      onCleanup(editor.onEditorEvent('node:reparented', invalidateAll))
      onCleanup(editor.onEditorEvent('node:reordered', invalidateAll))
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
