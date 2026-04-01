<script setup lang="ts">
import { TreeRoot, TreeItem, ContextMenuRoot, ContextMenuTrigger, ContextMenuPortal } from 'reka-ui'

import {
  LayerTreeRoot,
  LayerTreeItem,
  useI18n,
  useInlineRename,
  useLayerDrag
} from '@open-pencil/vue'
import { useEditorStore } from '@/stores/editor'
import { nodeIcon, COMPONENT_TYPES } from '@/utils/layer-icons'
import CanvasMenu from './CanvasMenu.vue'
import Tip from './ui/Tip.vue'

const INDENT = 16
const store = useEditorStore()
const rename = useInlineRename((id, name) => store.renameNode(id, name))
const { menu: t } = useI18n()
const { draggingId, instruction, instructionTargetId } = useLayerDrag(store, INDENT)

function onLayerRightClick(e: MouseEvent) {
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-node-id]')
  if (!row?.dataset.nodeId) return
  if (!store.state.selectedIds.has(row.dataset.nodeId)) store.select([row.dataset.nodeId])
}
</script>

<template>
  <LayerTreeRoot
    v-slot="{ items, expanded, treeKey, getKey, getChildren }"
    :indent-per-level="INDENT"
  >
    <ContextMenuRoot :modal="false">
      <ContextMenuTrigger as-child @contextmenu="onLayerRightClick">
        <div class="relative scrollbar-thin flex-1 overflow-y-auto px-1">
          <TreeRoot
            :key="treeKey"
            v-slot="{ flattenItems }"
            :expanded="expanded"
            :items="items"
            :get-key="getKey"
            :get-children="getChildren"
          >
            <LayerTreeItem
              v-for="item in flattenItems"
              :key="item._id"
              v-slot="{
                node,
                isSelected,
                padLeft,
                select: selectNode,
                toggleExpand,
                toggleVisibility,
                toggleLock
              }"
              :node="item.value"
              :level="item.level"
              :has-children="item.hasChildren"
            >
              <TreeItem
                v-slot="{ isExpanded }"
                :value="item.value"
                :level="item.level"
                as-child
                @select="
                  (e: CustomEvent) => {
                    e.preventDefault()
                    selectNode(!!e.detail.originalEvent?.shiftKey)
                  }
                "
                @toggle="
                  (e: CustomEvent) => {
                    if (e.detail.originalEvent?.type === 'click') e.preventDefault()
                  }
                "
              >
                <!-- Rename mode -->
                <div
                  v-if="rename.editingId.value === node.id"
                  class="flex w-full items-center gap-1 py-1"
                  :style="{ paddingLeft: padLeft }"
                >
                  <span
                    v-if="item.hasChildren"
                    class="flex w-4 shrink-0 cursor-pointer items-center justify-center text-muted transition-transform hover:text-surface"
                    :class="isExpanded ? 'rotate-90' : 'rotate-0'"
                    @click.stop="toggleExpand"
                  >
                    <icon-lucide-chevron-right class="size-3" />
                  </span>
                  <span v-else class="w-4 shrink-0" />
                  <component :is="nodeIcon(node)" class="size-3 shrink-0 opacity-70" />
                  <input
                    :ref="
                      (el) => {
                        if (el) rename.focusInput(el as HTMLInputElement)
                      }
                    "
                    data-layer-edit
                    data-test-id="layers-item-input"
                    class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0 text-xs text-surface outline-none"
                    :value="node.name"
                    @blur="rename.commit(node.id, $event.target as HTMLInputElement)"
                    @keydown.stop="rename.onKeydown"
                  />
                </div>

                <!-- Normal row -->
                <button
                  v-else
                  data-test-id="layers-item"
                  class="group/row relative flex w-full cursor-pointer items-center gap-1 rounded border-none py-1 pr-1 text-left text-xs"
                  :class="[
                    isSelected
                      ? 'bg-accent text-white'
                      : 'bg-transparent text-surface hover:bg-hover',
                    draggingId === node.id ? 'opacity-30' : '',
                    instructionTargetId === node.id && instruction?.type === 'make-child'
                      ? 'ring-2 ring-accent ring-inset'
                      : '',
                    !node.visible ? 'opacity-50' : ''
                  ]"
                  :style="{ paddingLeft: padLeft }"
                  @dblclick="rename.start(node.id, node.name)"
                >
                  <span
                    v-if="item.hasChildren"
                    class="flex w-4 shrink-0 cursor-pointer items-center justify-center text-muted transition-transform hover:text-surface"
                    :class="isExpanded ? 'rotate-90' : 'rotate-0'"
                    @click.stop="toggleExpand"
                  >
                    <icon-lucide-chevron-right class="size-3" />
                  </span>
                  <span v-else class="w-4 shrink-0" />

                  <component
                    :is="nodeIcon(node)"
                    class="size-3 shrink-0"
                    :class="
                      COMPONENT_TYPES.has(node.type) ? 'text-component opacity-100' : 'opacity-70'
                    "
                  />
                  <span class="min-w-0 flex-1 truncate">{{ node.name }}</span>

                  <span
                    class="flex shrink-0 items-center gap-0.5"
                    :class="
                      !node.locked && node.visible ? 'opacity-0 group-hover/row:opacity-100' : ''
                    "
                  >
                    <Tip :label="node.locked ? t.unlock : t.lock">
                      <span
                        class="flex size-4 items-center justify-center rounded hover:bg-white/15"
                        @pointerdown.stop
                        @click.stop="toggleLock"
                      >
                        <icon-lucide-lock
                          v-if="node.locked"
                          class="size-3"
                          :class="isSelected ? 'text-white' : 'text-surface'"
                        />
                        <icon-lucide-unlock
                          v-else
                          class="size-3 opacity-0 group-hover/row:opacity-100"
                          :class="isSelected ? 'text-white/80' : 'text-surface/70'"
                        />
                      </span>
                    </Tip>
                    <Tip :label="node.visible ? t.hide : t.show">
                      <span
                        class="flex size-4 items-center justify-center rounded hover:bg-white/15"
                        @pointerdown.stop
                        @click.stop="toggleVisibility"
                      >
                        <icon-lucide-eye-off
                          v-if="!node.visible"
                          class="size-3"
                          :class="isSelected ? 'text-white' : 'text-surface'"
                        />
                        <icon-lucide-eye
                          v-else
                          class="size-3 opacity-0 group-hover/row:opacity-100"
                          :class="isSelected ? 'text-white/80' : 'text-surface/70'"
                        />
                      </span>
                    </Tip>
                  </span>

                  <!-- DnD indicator -->
                  <div
                    v-if="
                      instructionTargetId === node.id &&
                      instruction &&
                      instruction.type !== 'make-child'
                    "
                    class="pointer-events-none absolute h-0.5 bg-accent"
                    :class="{
                      'bottom-0': instruction.type === 'reorder-below',
                      'top-0': instruction.type === 'reorder-above'
                    }"
                    :style="{
                      left: `${(item.level - 1) * INDENT}px`,
                      width: `calc(100% - ${(item.level - 1) * INDENT}px)`
                    }"
                  />
                </button>
              </TreeItem>
            </LayerTreeItem>
          </TreeRoot>
        </div>
      </ContextMenuTrigger>
      <ContextMenuPortal>
        <CanvasMenu />
      </ContextMenuPortal>
    </ContextMenuRoot>
  </LayerTreeRoot>
</template>
