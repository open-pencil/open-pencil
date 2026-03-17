<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { TreeRoot, ContextMenuRoot, ContextMenuTrigger, ContextMenuPortal } from 'reka-ui'

import { useInlineRename, useLayerDrag } from '@open-pencil/vue'

import { useEditorStore } from '@/stores/editor'
import LayerRow from './LayerRow.vue'
import CanvasMenu from './CanvasMenu.vue'

const INDENT_PER_LEVEL = 16

const store = useEditorStore()
const rename = useInlineRename((id, name) => store.renameNode(id, name))

const { draggingId, instruction, instructionTargetId, setupItem } = useLayerDrag(
  store,
  INDENT_PER_LEVEL
)

// ─── Layer node type ────────────────────────────────────────

interface LayerNode {
  id: string
  name: string
  type: string
  layoutMode: string
  visible: boolean
  locked: boolean
  children?: LayerNode[]
}

// ─── Tree data ──────────────────────────────────────────────

function buildTree(parentId: string): LayerNode[] {
  const parent = store.graph.getNode(parentId)
  if (!parent) return []
  return parent.childIds
    .map((cid) => store.graph.getNode(cid))
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

const items = ref(buildTree(store.state.currentPageId))
const treeKey = ref(0)
const expanded = ref<string[]>([])

watch([() => store.state.sceneVersion, () => store.state.currentPageId], () => {
  items.value = buildTree(store.state.currentPageId)
  treeKey.value++
})

const rowRefs = new Map<string, HTMLElement>()

function setRowRef(id: string, el: HTMLElement | null) {
  if (el) rowRefs.set(id, el)
  else rowRefs.delete(id)
}

watch(
  () => store.state.selectedIds,
  (ids) => {
    const toExpand = new Set(expanded.value)
    for (const id of ids) {
      let node = store.graph.getNode(id)
      while (node?.parentId && node.parentId !== store.state.currentPageId) {
        toExpand.add(node.parentId)
        node = store.graph.getNode(node.parentId)
      }
    }
    if (toExpand.size > expanded.value.length) expanded.value = [...toExpand]
    nextTick(() => {
      const first = [...ids][0]
      if (first) rowRefs.get(first)?.scrollIntoView({ block: 'nearest' })
    })
  }
)

// ─── Selection ──────────────────────────────────────────────

function onSelect(ev: CustomEvent) {
  ev.preventDefault()
  const node = ev.detail.value as LayerNode
  if (ev.detail.originalEvent?.shiftKey) {
    store.select([node.id], true)
  } else {
    store.select([node.id])
    syncCanvasScope(node.id)
  }
}

function syncCanvasScope(nodeId: string) {
  const node = store.graph.getNode(nodeId)
  if (!node) return
  let parentId = node.parentId
  while (parentId && parentId !== store.state.currentPageId) {
    if (store.graph.isContainer(parentId)) {
      store.enterContainer(parentId)
      return
    }
    const parent = store.graph.getNode(parentId)
    parentId = parent?.parentId ?? null
  }
  store.state.enteredContainerId = null
}

function onLayerRightClick(e: MouseEvent) {
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-node-id]')
  if (!row?.dataset.nodeId) return
  if (!store.state.selectedIds.has(row.dataset.nodeId)) {
    store.select([row.dataset.nodeId])
  }
}

function toggleExpand(id: string) {
  const idx = expanded.value.indexOf(id)
  if (idx !== -1) expanded.value = expanded.value.filter((e) => e !== id)
  else expanded.value = [...expanded.value, id]
}
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child @contextmenu="onLayerRightClick">
      <div class="relative scrollbar-thin flex-1 overflow-y-auto px-1">
        <TreeRoot
          :key="treeKey"
          v-slot="{ flattenItems }"
          v-model:expanded="expanded"
          :items="items"
          :get-key="(v: LayerNode) => v.id"
          :get-children="(v: LayerNode) => v.children"
        >
          <LayerRow
            v-for="item in flattenItems"
            :key="item._id"
            :ref="(comp: any) => setRowRef(item.value.id, comp?.rowEl ?? null)"
            :item-value="item.value"
            :level="item.level"
            :has-children="item.hasChildren"
            :rename="rename"
            :store="store"
            :dragging-id="draggingId"
            :instruction="instruction"
            :instruction-target-id="instructionTargetId"
            :indent-per-level="INDENT_PER_LEVEL"
            :setup-item="setupItem"
            @select="onSelect"
            @toggle-expand="toggleExpand"
          />
        </TreeRoot>
      </div>
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <CanvasMenu />
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
