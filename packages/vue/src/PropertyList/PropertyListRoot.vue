<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'

import { useEditor } from '@open-pencil/vue/context/editorContext'
import { useNodeProps } from '@open-pencil/vue/controls/useNodeProps'
import { useSceneComputed } from '@open-pencil/vue/internal/useSceneComputed'
import { providePropertyList } from './context'

import type { Fill, Stroke, Effect, SceneNode } from '@open-pencil/core'

type ArrayPropKey = 'fills' | 'strokes' | 'effects'
type ArrayItemType = Fill | Stroke | Effect

const { propKey } = defineProps<{
  propKey: ArrayPropKey
  label?: string
}>()

const emit = defineEmits<{
  add: [item: ArrayItemType]
  remove: [index: number]
  update: [index: number, item: ArrayItemType]
  patch: [index: number, changes: Record<string, unknown>]
  toggleVisibility: [index: number]
}>()

const editor = useEditor()
const { isArrayMixed } = useNodeProps()

const selectedNodes = useSceneComputed(() => {
  void editor.state.sceneVersion
  return editor.getSelectedNodes()
})
const activeNode = useSceneComputed<SceneNode | null>(() => {
  void editor.state.sceneVersion
  return editor.getSelectedNode() ?? selectedNodes.value[0] ?? null
})
const isMulti = computed(() => selectedNodes.value.length > 1)
const active = computed(() => selectedNodes.value.length > 0)

const isMixed = computed(() => isArrayMixed(propKey))

const items = useSceneComputed(() => {
  void editor.state.sceneVersion
  if (isMixed.value) return []
  return (activeNode.value?.[propKey] ?? []) as ArrayItemType[]
})

function targetNodes(): SceneNode[] {
  if (isMulti.value) return selectedNodes.value
  return activeNode.value ? [activeNode.value] : []
}

const BATCH_IDLE_MS = 300
let batchKey: string | null = null
let batchTimer: ReturnType<typeof setTimeout> | null = null

function flushBatch() {
  if (batchTimer !== null) {
    clearTimeout(batchTimer)
    batchTimer = null
  }
  if (batchKey !== null) {
    editor.undo.commitBatch()
    batchKey = null
  }
}

function ensureBatch(key: string, label: string) {
  if (batchKey !== key) {
    flushBatch()
    editor.undo.beginBatch(label)
    batchKey = key
  }
  if (batchTimer !== null) clearTimeout(batchTimer)
  batchTimer = setTimeout(flushBatch, BATCH_IDLE_MS)
}

onBeforeUnmount(flushBatch)

function add(defaults: ArrayItemType) {
  flushBatch()
  emit('add', defaults)
  for (const n of targetNodes()) {
    const arr = isMulti.value ? [defaults] : [...n[propKey], defaults]
    editor.updateNodeWithUndo(
      n.id,
      { [propKey]: arr } as Partial<SceneNode>,
      isMulti.value ? `Set ${propKey}` : `Add ${propKey}`
    )
  }
}

function remove(index: number) {
  flushBatch()
  emit('remove', index)
  for (const n of targetNodes()) {
    editor.updateNodeWithUndo(
      n.id,
      {
        [propKey]: (n[propKey] as ArrayItemType[]).filter((_, i) => i !== index)
      } as Partial<SceneNode>,
      `Remove ${propKey}`
    )
  }
}

function update(index: number, item: ArrayItemType) {
  emit('update', index, item)
  const nodes = targetNodes()
  if (nodes.length === 0) return
  const key = `update:${propKey}:${index}:${nodes.map((n) => n.id).join(',')}`
  ensureBatch(key, `Change ${propKey}`)
  for (const n of nodes) {
    const arr = [...n[propKey]] as ArrayItemType[]
    arr[index] = item
    editor.updateNodeWithUndo(n.id, { [propKey]: arr } as Partial<SceneNode>, `Change ${propKey}`)
  }
}

function patch(index: number, changes: Record<string, unknown>) {
  emit('patch', index, changes)
  const nodes = targetNodes()
  if (nodes.length === 0) return
  const key = `patch:${propKey}:${index}:${nodes.map((n) => n.id).join(',')}`
  ensureBatch(key, `Change ${propKey}`)
  for (const n of nodes) {
    const arr = [...n[propKey]] as ArrayItemType[]
    arr[index] = { ...arr[index], ...changes } as ArrayItemType
    editor.updateNodeWithUndo(n.id, { [propKey]: arr } as Partial<SceneNode>, `Change ${propKey}`)
  }
}

function toggleVisibility(index: number) {
  flushBatch()
  emit('toggleVisibility', index)
  const nodes = targetNodes()
  if (nodes.length === 0) return
  if (nodes.length > 1) {
    editor.undo.beginBatch(`Toggle ${propKey} visibility`)
  }
  for (const n of nodes) {
    const liveNode = editor.getNode(n.id)
    if (!liveNode) continue
    const arr = liveNode[propKey] as Array<{ visible: boolean }>
    if (!arr[index]) continue
    const newArr = [...liveNode[propKey]] as Array<{ visible: boolean }>
    newArr[index] = { ...newArr[index], visible: !arr[index].visible }
    editor.updateNodeWithUndo(
      n.id,
      { [propKey]: newArr } as Partial<SceneNode>,
      `Toggle ${propKey} visibility`
    )
  }
  if (nodes.length > 1) {
    editor.undo.commitBatch()
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
