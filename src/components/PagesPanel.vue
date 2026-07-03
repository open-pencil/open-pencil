<script setup lang="ts">
import { ref, watch, type ComponentPublicInstance } from 'vue'
import { templateRef } from '@vueuse/core'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'

import type { SceneNode } from '@open-pencil/scene-graph'
import { PageListRoot, useFlatReorderDrag, useI18n, useInlineRename } from '@open-pencil/vue'

import Tip from '@/components/ui/Tip.vue'
import { useMenuUI } from '@/components/ui/menu'

type PageItem = Pick<SceneNode, 'id' | 'name' | 'childIds'>

interface PageActions {
  rename: (pageId: string, name: string) => void
  delete: (pageId: string) => void
  move: (pageId: string, index: number) => void
}

const pageInput = templateRef<HTMLInputElement>('pageInput')
const rename = useInlineRename((id, name) => pageActions.value?.rename(id, name))
const { panels, pages: pageMessages } = useI18n()
const menuCls = useMenuUI({ content: 'min-w-36 shadow-[0_8px_30px_rgb(0_0_0/0.4)]' })

const pageActions = ref<Pick<PageActions, 'rename'> | null>(null)
const currentPages = ref<readonly PageItem[]>([])
const currentMovePage = ref<PageActions['move'] | null>(null)
const pageReorder = useFlatReorderDrag<PageItem>({
  items: () => currentPages.value,
  onMove: (pageId, index) => currentMovePage.value?.(pageId, index)
})

function setPageActions(renamePage: (pageId: string, name: string) => void) {
  pageActions.value = { rename: renamePage }
}

watch(pageInput, (input) => {
  if (input) void rename.focusInput(input)
})

function startRename(pg: PageItem, renamePage: (pageId: string, name: string) => void) {
  setPageActions(renamePage)
  rename.start(pg.id, pg.name)
}

function isDraggingTarget(pg: PageItem, operation: 'reorder-before' | 'reorder-after') {
  return (
    pageReorder.instructionTargetId.value === pg.id &&
    pageReorder.instruction.value?.operation === operation
  )
}

function setupPageRowRef(
  value: Element | ComponentPublicInstance | null,
  pg: PageItem,
  pages: readonly PageItem[],
  movePage: PageActions['move']
) {
  currentPages.value = pages
  currentMovePage.value = movePage
  pageReorder.setupItem(value instanceof HTMLElement ? value : null, () => ({ id: pg.id }))
}
</script>

<template>
  <PageListRoot v-slot="{ pages, currentPageId, isDivider, actions }">
    <div data-test-id="pages-panel" class="flex min-h-0 flex-1 flex-col">
      <div class="flex shrink-0 items-center justify-between px-3 py-1.5">
        <span data-test-id="pages-header" class="text-[11px] tracking-wider text-muted uppercase">{{
          panels.pages
        }}</span>
        <Tip :label="panels.addPage">
          <button
            data-test-id="pages-add"
            class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
            @click="actions.add()"
          >
            +
          </button>
        </Tip>
      </div>
      <div class="min-h-0 flex-1 overflow-hidden">
        <div
          data-test-id="pages-scroll"
          class="scrollbar-thin h-full overflow-x-hidden overflow-y-auto px-1 pb-1"
        >
          <ContextMenuRoot v-for="pg in pages" :key="pg.id" :modal="false">
            <ContextMenuTrigger as-child>
              <div
                data-test-id="pages-row"
                :ref="(value) => setupPageRowRef(value, pg, pages, actions.move)"
                class="relative cursor-grab active:cursor-grabbing"
                :class="pageReorder.draggingId.value === pg.id ? 'opacity-60' : ''"
                :data-page-id="pg.id"
              >
                <div
                  v-if="isDraggingTarget(pg, 'reorder-before')"
                  data-test-id="pages-drop-indicator"
                  class="pointer-events-none absolute inset-x-1 top-0 z-10 h-0.5 rounded-full bg-accent"
                />
                <div
                  v-if="rename.editingId.value === pg.id"
                  class="flex w-full items-center gap-1.5 rounded px-2 py-1"
                >
                  <icon-lucide-file class="size-3 shrink-0 opacity-70" />
                  <input
                    ref="pageInput"
                    data-test-id="pages-item-input"
                    class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0 text-xs text-surface outline-none"
                    :value="pg.name"
                    @blur="rename.commit(pg.id, $event)"
                    @keydown.stop="rename.onKeydown"
                  />
                </div>
                <div
                  v-else-if="isDivider(pg)"
                  data-test-id="pages-divider"
                  class="my-1 flex cursor-pointer items-center px-2"
                  @dblclick="startRename(pg, actions.rename)"
                >
                  <div class="h-px flex-1 bg-border" />
                </div>
                <button
                  v-else
                  data-test-id="pages-item"
                  class="flex w-full cursor-pointer items-center gap-1.5 rounded border-none px-2 py-1 text-left text-xs"
                  :class="
                    pg.id === currentPageId
                      ? 'bg-hover text-surface'
                      : 'bg-transparent text-muted hover:bg-hover hover:text-surface'
                  "
                  @click="actions.switch(pg.id)"
                  @dblclick="startRename(pg, actions.rename)"
                >
                  <icon-lucide-file class="size-3 shrink-0" />
                  <span class="truncate">{{ pg.name }}</span>
                </button>
                <div
                  v-if="isDraggingTarget(pg, 'reorder-after')"
                  data-test-id="pages-drop-indicator"
                  class="pointer-events-none absolute inset-x-1 bottom-0 z-10 h-0.5 rounded-full bg-accent"
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuPortal>
              <ContextMenuContent :class="menuCls.content" :side-offset="2" align="start">
                <ContextMenuItem
                  data-test-id="pages-context-rename"
                  :class="menuCls.item"
                  @select="startRename(pg, actions.rename)"
                >
                  <icon-lucide-pencil :class="menuCls.icon" />
                  <span>{{ pageMessages.rename }}</span>
                </ContextMenuItem>
                <ContextMenuItem
                  data-test-id="pages-context-delete"
                  :class="menuCls.item"
                  :disabled="pages.length <= 1"
                  @select="actions.delete(pg.id)"
                >
                  <icon-lucide-trash-2 :class="menuCls.icon" />
                  <span>{{ pageMessages.delete }}</span>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenuPortal>
          </ContextMenuRoot>
        </div>
      </div>
    </div>
  </PageListRoot>
</template>
