import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { isNodeArrayMixed } from '#vue/controls/node-props/helpers'
import { useNodeProps } from '#vue/controls/node-props/use'
import { useUndoBatch } from '#vue/controls/undo-batch/use'
import { useEditor } from '#vue/editor/context'
import type {
  PropertyListActions,
  PropertyListItemFor,
  PropertyListKey,
  PropertyListPatchFor
} from '#vue/primitives/PropertyList/types.ts'

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= items.length) return items
  const next = [...items]
  const moved = next.splice(fromIndex, 1)[0]
  if (moved === undefined) return items
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved)
  return next
}

export function useEditorPropertyList<K extends PropertyListKey>(propKey: K) {
  const editor = useEditor()
  const { nodes: selectedNodes, activeNode } = useNodeProps()
  const batch = useUndoBatch(editor.undo, editor.beginInteractiveEdit)
  const selectedNodeIds = computed(() => selectedNodes.value.map((node) => node.id))
  const isMulti = computed(() => selectedNodes.value.length > 1)
  const active = computed(() => selectedNodes.value.length > 0)
  // Figma leaves layers without strokes out when it compares strokes, so a stroke on some of the
  // selection shows as theirs; fills and effects still differ when a layer has none.
  const shownNodes = computed(() => {
    if (propKey !== 'strokes') return selectedNodes.value
    const stroked = selectedNodes.value.filter((node) => node.strokes.length > 0)
    return stroked.length > 0 ? stroked : selectedNodes.value
  })
  const isMixed = computed(() => isNodeArrayMixed(shownNodes.value, propKey))
  const items = computed<PropertyListItemFor<K>[]>(() => {
    if (isMixed.value) return []
    const shown = shownNodes.value.at(0)
    return (shown?.[propKey] ?? []) as PropertyListItemFor<K>[]
  })

  function targetNodes(): SceneNode[] {
    if (isMulti.value) return selectedNodes.value
    return activeNode.value ? [activeNode.value] : []
  }

  /** A layer without strokes takes the shown ones when they are edited, as in Figma. */
  function propArray(node: SceneNode): PropertyListItemFor<K>[] {
    const own = node[propKey] as PropertyListItemFor<K>[]
    return own.length === 0 && !isMixed.value ? items.value : own
  }

  function updateArray(node: SceneNode, value: PropertyListItemFor<K>[], label: string) {
    editor.updateNodeWithUndo(node.id, { [propKey]: value } as Partial<SceneNode>, label)
  }

  function add(item: PropertyListItemFor<K>) {
    batch.flush()
    const nodes = targetNodes()
    const label = isMulti.value ? `Set ${propKey}` : `Add ${propKey}`
    const apply = () => {
      for (const node of nodes) {
        const nextItem = structuredClone(item)
        const next = isMulti.value ? [nextItem] : [...propArray(node), nextItem]
        updateArray(node, next, label)
      }
    }
    if (nodes.length > 1) editor.undo.runBatch(label, apply)
    else apply()
  }

  function remove(index: number) {
    batch.flush()
    const nodes = targetNodes()
    const label = `Remove ${propKey}`
    const apply = () => {
      for (const node of nodes) {
        updateArray(
          node,
          propArray(node).filter((_, itemIndex) => itemIndex !== index),
          label
        )
      }
    }
    if (nodes.length > 1) editor.undo.runBatch(label, apply)
    else apply()
  }

  function update(index: number, item: PropertyListItemFor<K>) {
    const nodes = targetNodes()
    if (nodes.length === 0) return
    batch.ensure(
      `update:${propKey}:${index}:${nodes.map((node) => node.id).join(',')}`,
      `Change ${propKey}`
    )
    for (const node of nodes) {
      const next = [...propArray(node)]
      next[index] = structuredClone(item)
      updateArray(node, next, `Change ${propKey}`)
    }
  }

  function patch(index: number, changes: PropertyListPatchFor<K>) {
    const nodes = targetNodes()
    if (nodes.length === 0) return
    batch.ensure(
      `patch:${propKey}:${index}:${nodes.map((node) => node.id).join(',')}`,
      `Change ${propKey}`
    )
    for (const node of nodes) {
      const current = propArray(node)[index]
      if (!current) continue
      const next = [...propArray(node)]
      next[index] = { ...current, ...structuredClone(changes) }
      updateArray(node, next, `Change ${propKey}`)
    }
  }

  function toggleVisibility(index: number) {
    batch.flush()
    const nodes = targetNodes()
    if (nodes.length === 0) return
    const apply = () => {
      for (const node of nodes) {
        const liveNode = editor.getNode(node.id)
        if (!liveNode) continue
        const current = propArray(liveNode)[index]
        if (!current) continue
        const next = [...propArray(liveNode)]
        next[index] = { ...current, visible: !current.visible }
        updateArray(liveNode, next, `Toggle ${propKey} visibility`)
      }
    }
    if (nodes.length > 1) editor.undo.runBatch(`Toggle ${propKey} visibility`, apply)
    else apply()
  }

  function reorder(fromIndex: number, toIndex: number) {
    batch.flush()
    const nodes = targetNodes()
    if (nodes.length === 0 || fromIndex === toIndex) return
    const apply = () => {
      for (const node of nodes) {
        updateArray(node, moveItem(propArray(node), fromIndex, toIndex), `Reorder ${propKey}`)
      }
    }
    if (nodes.length > 1) editor.undo.runBatch(`Reorder ${propKey}`, apply)
    else apply()
  }

  const actions: PropertyListActions<K> = {
    add,
    remove,
    update,
    patch,
    toggleVisibility,
    reorder
  }

  return {
    items,
    isMixed,
    isMulti,
    active,
    activeNode,
    selectedNodeIds,
    flush: batch.flush,
    actions
  }
}
