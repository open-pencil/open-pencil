<script setup lang="ts">
import { computed } from 'vue'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'

import { useEditorStore } from '@/stores/editor'

const { hash, names, nodeIds, thumbnailUrl } = defineProps<{
  hash: string
  names: string[]
  nodeIds: string[]
  thumbnailUrl: string
}>()

const store = useEditorStore()

const displayName = computed(() => {
  if (names.length === 0) return hash.slice(0, 8) + '…'
  if (names.length <= 2) return names.join(', ')
  return `${names[0]}, ${names[1]} +${names.length - 2}`
})

function currentPageNodeIds() {
  const descendants = new Set<string>()
  const stack = store.graph.getChildren(store.state.currentPageId).map((n) => n.id)
  while (stack.length > 0) {
    const id = stack.pop()
    if (!id) continue
    descendants.add(id)
    const node = store.graph.getNode(id)
    if (node) stack.push(...node.childIds)
  }
  return nodeIds.filter((id) => descendants.has(id))
}

function selectUses() {
  const ids = currentPageNodeIds()
  if (ids.length > 0) store.state.selectedIds = new Set(ids)
}

function onDragStart(e: DragEvent) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData('application/x-openpencil-image-asset', hash)
  e.dataTransfer.effectAllowed = 'copy'
}

function placeAtCenter() {
  const { x, y } = store.canvasViewportCenter()
  store.placeImageFromHash(hash, x, y)
}
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <div
        class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-hover"
        :draggable="true"
        @dragstart="onDragStart"
        @click="selectUses"
      >
        <div class="size-8 shrink-0 overflow-hidden rounded border border-border bg-canvas">
          <img :src="thumbnailUrl" class="size-full object-cover" :alt="displayName" />
        </div>
        <icon-lucide-image class="size-3 shrink-0 text-muted" />
        <span class="min-w-0 flex-1 truncate text-xs text-surface">{{ displayName }}</span>
        <span v-if="nodeIds.length > 0" class="shrink-0 text-[10px] text-muted">
          {{ nodeIds.length }}×
        </span>
      </div>
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent class="min-w-40 rounded-lg border border-border bg-panel p-1 shadow-lg">
        <ContextMenuItem
          class="cursor-pointer rounded px-2 py-1 text-xs text-surface hover:bg-hover"
          @select="selectUses"
        >
          Select all uses
        </ContextMenuItem>
        <ContextMenuItem
          class="cursor-pointer rounded px-2 py-1 text-xs text-surface hover:bg-hover"
          @select="placeAtCenter"
        >
          Place copy on canvas
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
