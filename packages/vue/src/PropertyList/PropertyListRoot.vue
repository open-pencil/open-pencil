<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '../shared/editorContext'
import { providePropertyList } from './context'

import type { Fill, Stroke, Effect, SceneNode } from '@open-pencil/core'

type ArrayPropKey = 'fills' | 'strokes' | 'effects'
type ArrayItemType = Fill | Stroke | Effect

const { propKey } = defineProps<{
  propKey: ArrayPropKey
  label?: string
}>()

const editor = useEditor()

const selectedNodes = computed(() => editor.getSelectedNodes())
const activeNode = computed<SceneNode | null>(() => editor.getSelectedNode() ?? selectedNodes.value[0] ?? null)
const isMulti = computed(() => selectedNodes.value.length > 1)
const active = computed(() => selectedNodes.value.length > 0)

const isMixed = computed(() => {
  const all = selectedNodes.value
  if (all.length <= 1) return false
  const firstArr = all[0][propKey] as unknown[]
  for (let i = 1; i < all.length; i++) {
    const arr = all[i][propKey] as unknown[]
    if (arr.length !== firstArr.length) return true
  }
  const first = JSON.stringify(firstArr)
  return all.some((n) => JSON.stringify(n[propKey]) !== first)
})

const items = computed(() => {
  if (isMixed.value) return []
  return (activeNode.value?.[propKey] ?? []) as ArrayItemType[]
})

function targetNodes(): SceneNode[] {
  if (isMulti.value) return selectedNodes.value
  return activeNode.value ? [activeNode.value] : []
}

function add(defaults: ArrayItemType) {
  for (const n of targetNodes()) {
    const arr = isMulti.value ? [defaults] : [...n[propKey], defaults]
    editor.updateNodeWithUndo(n.id, { [propKey]: arr } as Partial<SceneNode>, isMulti.value ? `Set ${propKey}` : `Add ${propKey}`)
  }
}

function remove(index: number) {
  for (const n of targetNodes()) {
    editor.updateNodeWithUndo(
      n.id,
      { [propKey]: (n[propKey] as ArrayItemType[]).filter((_, i) => i !== index) } as Partial<SceneNode>,
      `Remove ${propKey}`
    )
  }
}

function update(index: number, item: ArrayItemType) {
  for (const n of targetNodes()) {
    const arr = [...n[propKey]] as ArrayItemType[]
    arr[index] = item
    editor.updateNodeWithUndo(n.id, { [propKey]: arr } as Partial<SceneNode>, `Change ${propKey}`)
  }
}

function patch(index: number, changes: Record<string, unknown>) {
  for (const n of targetNodes()) {
    const arr = [...n[propKey]] as ArrayItemType[]
    arr[index] = { ...arr[index], ...changes } as ArrayItemType
    editor.updateNodeWithUndo(n.id, { [propKey]: arr } as Partial<SceneNode>, `Change ${propKey}`)
  }
}

function toggleVisibility(index: number) {
  for (const n of targetNodes()) {
    const arr = n[propKey] as Array<{ visible: boolean }>
    if (!arr[index]) continue
    const newArr = [...n[propKey]] as Array<{ visible: boolean }>
    newArr[index] = { ...newArr[index], visible: !arr[index].visible }
    editor.updateNodeWithUndo(n.id, { [propKey]: newArr } as Partial<SceneNode>, `Toggle ${propKey} visibility`)
  }
}

providePropertyList({
  editor,
  propKey,
  items,
  isMixed,
  activeNode,
  isMulti,
  add,
  remove,
  update,
  patch,
  toggleVisibility
})
</script>

<template>
  <slot
    v-if="active"
    :items="items"
    :is-mixed="isMixed"
    :is-multi="isMulti"
    :active-node="activeNode"
    :add="add"
    :remove="remove"
    :update="update"
    :patch="patch"
    :toggle-visibility="toggleVisibility"
  />
</template>
