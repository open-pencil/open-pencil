<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { TreeRoot } from 'reka-ui'

import { useEditor } from '#vue/editor/context'
import { provideLayerTree } from '#vue/primitives/LayerTree/context'
import { useLayerDrag } from '#vue/primitives/LayerTree/useLayerDrag'

import type { LayerNode } from '#vue/primitives/LayerTree/context'
import type { SceneNode } from '@open-pencil/scene-graph'

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

function nodeToLayerNode(node: SceneNode): LayerNode {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    layoutMode: node.layoutMode,
    visible: node.visible,
    locked: node.locked
  }
}

function buildTree(parentId: string): LayerNode[] {
  const parent = editor.graph.getNode(parentId)
  if (!parent) return []
  return parent.childIds
    .map((cid) => editor.graph.getNode(cid))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((node) => ({
      ...nodeToLayerNode(node),
      children: node.childIds.length > 0 ? buildTree(node.id) : undefined
    }))
}

const items = ref(buildTree(editor.state.currentPageId))
const treeVersion = ref(0)
const expanded = ref<string[]>([])
const selectedIds = computed(() => editor.state.selectedIds)

function rebuildTree() {
  items.value = buildTree(editor.state.currentPageId)
  treeVersion.value++
}

function replaceLayerNode(nodes: LayerNode[], replacement: LayerNode): LayerNode[] | null {
  let changed = false
  const next = nodes.map((node) => {
    if (node.id === replacement.id) {
      changed = true
      return { ...replacement, children: node.children }
    }
    if (!node.children) return node
    const children = replaceLayerNode(node.children, replacement)
    if (!children) return node
    changed = true
    return { ...node, children }
  })
  return changed ? next : null
}

function patchLayerNode(id: string, changes: Partial<SceneNode>) {
  if ('childIds' in changes || 'parentId' in changes) {
    rebuildTree()
    return
  }

  if (
    !(
      'name' in changes ||
      'type' in changes ||
      'layoutMode' in changes ||
      'visible' in changes ||
      'locked' in changes
    )
  ) {
    return
  }

  const node = editor.graph.getNode(id)
  if (!node) return
  const next = replaceLayerNode(items.value, nodeToLayerNode(node))
  if (next) items.value = next
}

const unsubscribe = [
  editor.onEditorEvent('graph:replaced', rebuildTree),
  editor.onEditorEvent('page:changed', rebuildTree),
  editor.onEditorEvent('node:created', rebuildTree),
  editor.onEditorEvent('node:deleted', rebuildTree),
  editor.onEditorEvent('node:reparented', rebuildTree),
  editor.onEditorEvent('node:reordered', rebuildTree),
  editor.onEditorEvent('node:updated', patchLayerNode)
]

onScopeDispose(() => {
  for (const stop of unsubscribe) stop()
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
  treeVersion,
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
    v-slot="{ flattenItems }"
    as="div"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    v-model:expanded="expanded"
    :items="items"
    :get-key="getKey"
    :get-children="getChildren"
  >
    <slot
      :items="items"
      :flatten-items="flattenItems"
      :expanded="expanded"
      :tree-version="treeVersion"
      :selected-ids="selectedIds"
      :dragging-id="draggingId"
      :instruction="instruction"
      :instruction-target-id="instructionTargetId"
      :actions="actions"
    />
  </TreeRoot>
</template>
