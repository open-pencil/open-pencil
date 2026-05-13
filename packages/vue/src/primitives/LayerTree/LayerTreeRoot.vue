<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { TreeRoot } from 'reka-ui'

import { useEditor } from '#vue/editor/context'
import { provideLayerTree } from '#vue/primitives/LayerTree/context'
import { useLayerDrag } from '#vue/primitives/LayerTree/useLayerDrag'

import type { LayerNode } from '#vue/primitives/LayerTree/context'

const { indentPerLevel = 16 } = defineProps<{
  indentPerLevel?: number
}>()

const emit = defineEmits<{
  select: [id: string, additive: boolean]
  toggleExpand: [id: string]
  toggleVisibility: [id: string]
  toggleLock: [id: string]
  rename: [id: string, name: string]
}>()

const editor = useEditor()

function expandNode(id: string) {
  if (!expanded.value.includes(id)) expanded.value = [...expanded.value, id]
}

const { draggingId, instruction, instructionTargetId, setupItem } = useLayerDrag(
  editor,
  indentPerLevel,
  expandNode
)

function buildTree(parentId: string): LayerNode[] {
  const parent = editor.graph.getNode(parentId)
  if (!parent) return []
  return parent.childIds
    .map((cid) => editor.graph.getNode(cid))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      layoutMode: node.layoutMode,
      visible: node.visible,
      locked: node.locked,
      children: node.childIds.length > 0 ? buildTree(node.id) : undefined
    }))
}

const items = ref(buildTree(editor.state.currentPageId))
const treeKey = ref(0)
const expanded = ref<string[]>([])
const selectedIds = computed(() => editor.state.selectedIds)

watch([() => editor.state.sceneVersion, () => editor.state.currentPageId], () => {
  items.value = buildTree(editor.state.currentPageId)
  treeKey.value++
})

const rowRefs = new Map<string, HTMLElement>()

function setRowRef(id: string, el: HTMLElement | null) {
  if (el) rowRefs.set(id, el)
  else rowRefs.delete(id)
}

watch(
  () => editor.state.selectedIds,
  (ids) => {
    const toExpand = new Set(expanded.value)
    for (const id of ids) {
      let node = editor.graph.getNode(id)
      while (node?.parentId && node.parentId !== editor.state.currentPageId) {
        toExpand.add(node.parentId)
        node = editor.graph.getNode(node.parentId)
      }
    }
    if (toExpand.size > expanded.value.length) expanded.value = [...toExpand]
    nextTick(() => {
      const first = [...ids][0]
      if (first) rowRefs.get(first)?.scrollIntoView({ block: 'nearest' })
    })
  }
)

function syncCanvasScope(nodeId: string) {
  const node = editor.graph.getNode(nodeId)
  if (!node) return
  let parentId = node.parentId
  while (parentId && parentId !== editor.state.currentPageId) {
    if (editor.graph.isContainer(parentId)) {
      editor.enterContainer(parentId)
      return
    }
    const parent = editor.graph.getNode(parentId)
    parentId = parent?.parentId ?? null
  }
  editor.state.enteredContainerId = null
}

function select(id: string, additive: boolean) {
  emit('select', id, additive)
  if (additive) {
    editor.select([id], true)
  } else {
    editor.select([id])
    syncCanvasScope(id)
  }
}

function toggleExpand(id: string) {
  emit('toggleExpand', id)
  const idx = expanded.value.indexOf(id)
  if (idx !== -1) expanded.value = expanded.value.filter((e) => e !== id)
  else expandNode(id)
}

function getKey(node: LayerNode) {
  return node.id
}

function getChildren(node: LayerNode) {
  return node.children
}

const actions = {
  select,
  toggleExpand
}

provideLayerTree({
  editor,
  items,
  expanded,
  treeKey,
  selectedIds,
  indentPerLevel,
  draggingId,
  instruction,
  instructionTargetId,
  setupDrag: setupItem,
  select,
  toggleExpand,
  toggleVisibility: (id: string) => {
    emit('toggleVisibility', id)
    editor.toggleNodeVisibility(id)
  },
  toggleLock: (id: string) => {
    emit('toggleLock', id)
    editor.toggleNodeLock(id)
  },
  rename: (id: string, name: string) => {
    emit('rename', id, name)
    editor.renameNode(id, name)
  },
  setRowRef
})
</script>

<template>
  <TreeRoot
    :key="treeKey"
    v-slot="{ flattenItems }"
    :expanded="expanded"
    :items="items"
    :get-key="getKey"
    :get-children="getChildren"
  >
    <slot
      :items="items"
      :flatten-items="flattenItems"
      :expanded="expanded"
      :tree-key="treeKey"
      :selected-ids="selectedIds"
      :dragging-id="draggingId"
      :instruction="instruction"
      :instruction-target-id="instructionTargetId"
      :actions="actions"
    />
  </TreeRoot>
</template>
