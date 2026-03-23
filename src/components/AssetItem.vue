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

import type { SceneNode } from '@open-pencil/core'

const { node, thumbnailUrl, indented, isSet } = defineProps<{
  node: SceneNode
  thumbnailUrl?: string
  indented?: boolean
  isSet?: boolean
}>()

const store = useEditorStore()

const instanceCount = computed(() => {
  void store.state.sceneVersion
  return store.graph.instanceIndex.get(node.id)?.size ?? 0
})

function resolveInsertableId(): string | undefined {
  if (node.type === 'COMPONENT_SET') {
    return store.graph.getChildren(node.id).find((c) => c.type === 'COMPONENT')?.id
  }
  return node.id
}

function onDragStart(e: DragEvent) {
  if (!e.dataTransfer) return
  const id = resolveInsertableId()
  if (!id) return
  e.dataTransfer.setData('application/x-openpencil-component', id)
  e.dataTransfer.effectAllowed = 'copy'
}

function onDblClick() {
  const id = resolveInsertableId()
  if (!id) return
  const { x, y } = store.canvasViewportCenter()
  store.createInstanceFromComponent(id, x, y, store.state.currentPageId)
}

function goToComponent() {
  store.focusNode(node.id)
}
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <div
        :class="[
          'flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-hover',
          indented ? 'pl-6' : ''
        ]"
        :title="node.description || node.name"
        :draggable="true"
        @dragstart="onDragStart"
        @dblclick="onDblClick"
      >
        <div class="size-8 shrink-0 overflow-hidden rounded border border-border bg-canvas">
          <img
            v-if="thumbnailUrl"
            :src="thumbnailUrl"
            class="size-full object-contain"
            :alt="node.name"
          />
          <div v-else class="flex size-full items-center justify-center">
            <icon-lucide-component class="size-3.5 text-muted" />
          </div>
        </div>
        <icon-lucide-diamond
          v-if="node.type === 'COMPONENT'"
          class="size-3 shrink-0 text-[#9747ff]"
        />
        <icon-lucide-layout-grid v-else class="size-3 shrink-0 text-[#9747ff]" />
        <span class="min-w-0 flex-1 truncate text-xs text-surface">{{ node.name }}</span>
        <icon-lucide-chevron-down
          v-if="isSet"
          class="size-3 shrink-0 text-muted transition-transform [[data-state=closed]>&]:rotate-[-90deg]"
        />
        <span v-if="instanceCount > 0" class="shrink-0 text-[10px] text-muted">
          {{ instanceCount }}×
        </span>
      </div>
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent class="min-w-40 rounded-lg border border-border bg-panel p-1 shadow-lg">
        <ContextMenuItem
          class="cursor-pointer rounded px-2 py-1 text-xs text-surface hover:bg-hover"
          @select="onDblClick"
        >
          Insert instance
        </ContextMenuItem>
        <ContextMenuItem
          class="cursor-pointer rounded px-2 py-1 text-xs text-surface hover:bg-hover"
          @select="goToComponent"
        >
          Go to component
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
