import { computed } from 'vue'

import { useEditor } from '../context/editorContext'
import { useSceneComputed } from '../internal/useSceneComputed'

import type { Fill, SceneNode, Stroke } from '@open-pencil/core'

export const MIXED = Symbol('mixed')
export type MixedValue<T> = T | typeof MIXED

export function useNodeProps() {
  const store = useEditor()
  const node = useSceneComputed(() => store.getSelectedNode() ?? null)
  const nodes = useSceneComputed(() => store.getSelectedNodes())
  const isMulti = computed(() => nodes.value.length > 1)
  const active = computed(() => node.value || isMulti.value)
  const activeNode = computed(() => node.value ?? (nodes.value[0] as SceneNode | undefined) ?? null)

  function merged<K extends keyof SceneNode>(key: K): MixedValue<SceneNode[K]> {
    const all = nodes.value
    if (all.length === 0) return MIXED
    const first = all[0][key]
    for (let i = 1; i < all.length; i++) {
      if (all[i][key] !== first) return MIXED
    }
    return first
  }

  function prop<K extends keyof SceneNode>(key: K) {
    return computed(() => merged(key))
  }

  function updateAllWithUndo(patch: Partial<SceneNode>, label: string) {
    for (const n of nodes.value) {
      store.updateNodeWithUndo(n.id, patch, label)
    }
  }

  function isArrayMixed(key: keyof SceneNode): boolean {
    const all = nodes.value
    if (all.length <= 1) return false
    const first = JSON.stringify(all[0][key])
    return all.some((n) => JSON.stringify(n[key]) !== first)
  }

  type ArrayPropKey = 'fills' | 'strokes' | 'effects'

  function targetNodes(): SceneNode[] {
    if (isMulti.value) return nodes.value
    return activeNode.value ? [activeNode.value] : []
  }

  function updateArrayItem(
    key: ArrayPropKey,
    index: number,
    patch: Record<string, unknown> | Fill | Stroke,
    label: string
  ) {
    for (const n of targetNodes()) {
      const arr = [...n[key]]
      arr[index] = { ...arr[index], ...patch } as (typeof arr)[number]
      store.updateNodeWithUndo(n.id, { [key]: arr } as Partial<SceneNode>, label)
    }
  }

  function removeArrayItem(key: ArrayPropKey, index: number, label: string) {
    for (const n of targetNodes()) {
      store.updateNodeWithUndo(
        n.id,
        { [key]: (n[key] as unknown[]).filter((_, i) => i !== index) } as Partial<SceneNode>,
        label
      )
    }
  }

  function toggleArrayVisibility(key: ArrayPropKey, index: number) {
    for (const n of targetNodes()) {
      const items = n[key] as Array<{ visible: boolean }>
      if (!items[index]) continue
      const arr = [...n[key]]
      arr[index] = { ...arr[index], visible: !items[index].visible }
      store.updateNodeWithUndo(
        n.id,
        { [key]: arr } as Partial<SceneNode>,
        `Toggle ${key} visibility`
      )
    }
  }

  const previousValues = new Map<string, Record<string, number | string>>()

  function storePreviousValues(key: string) {
    for (const n of store.getSelectedNodes()) {
      let rec = previousValues.get(n.id)
      if (!rec) {
        rec = {}
        previousValues.set(n.id, rec)
      }
      if (!(key in rec)) {
        rec[key] = n[key as keyof SceneNode] as number | string
      }
    }
  }

  function updateProp(key: string, value: number | string) {
    if (store.getSelectedNodes().length > 1) {
      storePreviousValues(key)
      for (const n of store.getSelectedNodes()) {
        store.updateNode(n.id, { [key]: value })
      }
    } else {
      const node = store.getSelectedNode()
      if (node) store.updateNode(node.id, { [key]: value })
    }
  }

  function commitProp(key: string, _value: number | string, previous: number | string) {
    if (store.getSelectedNodes().length > 1) {
      for (const n of store.getSelectedNodes()) {
        const prev = previousValues.get(n.id)?.[key] ?? previous
        store.commitNodeUpdate(n.id, { [key]: prev } as Partial<SceneNode>, `Change ${key}`)
      }
      previousValues.clear()
    } else {
      const node = store.getSelectedNode()
      if (node) {
        store.commitNodeUpdate(node.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
      }
    }
  }

  return {
    store,
    node,
    nodes,
    isMulti,
    active,
    activeNode,
    targetNodes,
    prop,
    merged,
    updateAllWithUndo,
    updateArrayItem,
    removeArrayItem,
    toggleArrayVisibility,
    isArrayMixed,
    updateProp,
    commitProp
  }
}
