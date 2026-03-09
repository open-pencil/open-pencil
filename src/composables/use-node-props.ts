import { computed } from 'vue'

import { useEditorStore } from '@/stores/editor'

import type { SceneNode } from '@open-pencil/core'

export function useNodeProps() {
  const store = useEditorStore()
  const node = computed(() => store.selectedNode.value ?? null)
  const nodes = computed(() => store.selectedNodes.value)

  function updateProp(key: string, value: number | string) {
    if (store.selectedNodes.value.length > 1) {
      storePreviousValues(key)
      for (const n of store.selectedNodes.value) {
        store.updateNode(n.id, { [key]: value })
      }
    } else {
      const node = store.selectedNode.value
      if (node) store.updateNode(node.id, { [key]: value })
    }
  }

  const previousValues = new Map<string, Record<string, number | string>>()

  function storePreviousValues(key: string) {
    for (const n of store.selectedNodes.value) {
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

  function commitProp(key: string, _value: number | string, previous: number | string) {
    if (store.selectedNodes.value.length > 1) {
      for (const n of store.selectedNodes.value) {
        const prev = previousValues.get(n.id)?.[key] ?? previous
        store.commitNodeUpdate(n.id, { [key]: prev } as Partial<SceneNode>, `Change ${key}`)
      }
      previousValues.clear()
    } else {
      const node = store.selectedNode.value
      if (node) {
        store.commitNodeUpdate(node.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
      }
    }
  }

  return { store, node, nodes, updateProp, commitProp }
}
