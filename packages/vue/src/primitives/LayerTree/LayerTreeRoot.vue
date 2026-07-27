<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref } from 'vue'
import { TreeRoot } from 'reka-ui'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { provideLayerTree } from '#vue/primitives/LayerTree/context'
import {
  buildLayerTreeModel,
  layerSelectionForTarget,
  patchLayerNode,
  visibleLayerRows
} from '#vue/primitives/LayerTree/model'
import { useLayerDrag } from '#vue/primitives/LayerTree/useLayerDrag'

import type {
  LayerNode,
  LayerSelectionMode,
  LayerTreeVirtualizer
} from '#vue/primitives/LayerTree/context'

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
const items = ref<LayerNode[]>([])
const expanded = ref<string[]>([])
const treeVersion = ref(0)
const selectedIds = computed(() => editor.state.selectedIds)
const focused = ref(false)
const visibleRows = computed(() => visibleLayerRows(items.value, new Set(expanded.value)))
let nodesById = new Map<string, LayerNode>()
let virtualizer: LayerTreeVirtualizer | null = null
let selectionAnchorId: string | null = null
let applyingSelection = false

function expandNode(id: string) {
  if (!expanded.value.includes(id)) expanded.value = [...expanded.value, id]
}

const { draggingId, instruction, instructionTargetId, setupItem } = useLayerDrag(
  editor,
  indentPerLevel,
  expandNode
)

let rebuildPending = false
let rebuildToken = 0

function rebuildTree() {
  rebuildPending = false
  rebuildToken++
  const model = buildLayerTreeModel(editor.graph, editor.state.currentPageId)
  items.value = model.items
  nodesById = model.byId
  expanded.value = expanded.value.filter((id) => nodesById.has(id))
  treeVersion.value++
}

function scheduleTreeRebuild() {
  if (rebuildPending) return
  rebuildPending = true
  const token = ++rebuildToken
  queueMicrotask(() => {
    if (!rebuildPending || token !== rebuildToken) return
    rebuildTree()
  })
}

rebuildTree()

const PATCHABLE_NODE_KEYS = new Set<keyof SceneNode>([
  'name',
  'type',
  'layoutMode',
  'visible',
  'locked'
])

function patchTreeNode(id: string, changes: Partial<SceneNode>) {
  if ('childIds' in changes || 'parentId' in changes) {
    rebuildTree()
    return
  }
  if (!(Object.keys(changes) as (keyof SceneNode)[]).some((key) => PATCHABLE_NODE_KEYS.has(key))) {
    return
  }
  const target = nodesById.get(id)
  const source = editor.graph.getNode(id)
  if (target && source) patchLayerNode(target, source)
}

const rowRefs = new Map<string, HTMLElement>()

function setRowRef(id: string, el: HTMLElement | null) {
  if (el) rowRefs.set(id, el)
  else rowRefs.delete(id)
}

function expandSelectionAncestors(ids: readonly string[]) {
  const next = new Set(expanded.value)
  for (const id of ids) {
    let node = editor.graph.getNode(id)
    while (node?.parentId && node.parentId !== editor.state.currentPageId) {
      next.add(node.parentId)
      node = editor.graph.getNode(node.parentId)
    }
  }
  if (next.size !== expanded.value.length) expanded.value = [...next]
}

function scrollToNode(id: string) {
  void nextTick(() => {
    const index = visibleRows.value.findIndex((row) => row.node.id === id)
    if (index !== -1 && virtualizer) {
      virtualizer.scrollToIndex(index, { align: 'auto' })
      return
    }
    rowRefs.get(id)?.scrollIntoView({ block: 'nearest' })
  })
}

function onSelectionChanged(ids: string[]) {
  expandSelectionAncestors(ids)
  if (applyingSelection) return
  const visibleIds = new Set(visibleRows.value.map((row) => row.node.id))
  selectionAnchorId = ids.find((id) => visibleIds.has(id)) ?? null
  if (selectionAnchorId) scrollToNode(selectionAnchorId)
}

const unsubscribe = [
  editor.onEditorEvent('graph:replaced', rebuildTree),
  editor.onEditorEvent('page:changed', rebuildTree),
  editor.onEditorEvent('node:created', scheduleTreeRebuild),
  editor.onEditorEvent('node:deleted', scheduleTreeRebuild),
  editor.onEditorEvent('node:reparented', scheduleTreeRebuild),
  editor.onEditorEvent('node:reordered', scheduleTreeRebuild),
  editor.onEditorEvent('node:updated', patchTreeNode),
  editor.onEditorEvent('selection:changed', onSelectionChanged)
]

onScopeDispose(() => {
  for (const stop of unsubscribe) stop()
})

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

function select(id: string, selection: boolean | LayerSelectionMode) {
  const mode = typeof selection === 'boolean' ? { additive: selection, range: false } : selection
  emit('select', id, mode.additive)
  const visibleIds = visibleRows.value.map((row) => row.node.id)
  const next = layerSelectionForTarget(
    visibleIds,
    editor.state.selectedIds,
    selectionAnchorId,
    id,
    mode
  )
  if (!mode.range) selectionAnchorId = id
  applyingSelection = true
  try {
    editor.select([...next])
  } finally {
    applyingSelection = false
  }
  if (!mode.additive && !mode.range) syncCanvasScope(id)
  scrollToNode(id)
}

function toggleExpand(id: string) {
  emit('toggleExpand', id)
  const index = expanded.value.indexOf(id)
  if (index !== -1) expanded.value = expanded.value.filter((expandedId) => expandedId !== id)
  else expandNode(id)
}

function getKey(node: LayerNode) {
  return node.id
}

function getChildren(node: LayerNode) {
  return node.children
}

function setVirtualizer(next: LayerTreeVirtualizer) {
  virtualizer = next
}

const actions = {
  select,
  toggleExpand,
  setFocused: (value: boolean) => {
    focused.value = value
  },
  setVirtualizer
}

provideLayerTree({
  editor,
  items,
  expanded,
  visibleRows,
  treeVersion,
  selectedIds,
  focused,
  indentPerLevel,
  draggingId,
  instruction,
  instructionTargetId,
  setupDrag: setupItem,
  select,
  toggleExpand,
  setFocused: actions.setFocused,
  setVirtualizer,
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
    v-model:expanded="expanded"
    as="div"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    :items="items"
    :get-key="getKey"
    :get-children="getChildren"
  >
    <slot
      :items="items"
      :flatten-items="flattenItems"
      :visible-rows="visibleRows"
      :expanded="expanded"
      :tree-version="treeVersion"
      :selected-ids="selectedIds"
      :focused="focused"
      :dragging-id="draggingId"
      :instruction="instruction"
      :instruction-target-id="instructionTargetId"
      :actions="actions"
    />
  </TreeRoot>
</template>
