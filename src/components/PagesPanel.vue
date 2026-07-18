<script setup lang="ts">
import { ref, watch, type ComponentPublicInstance } from 'vue'
import { templateRef } from '@vueuse/core'
import { tv } from 'tailwind-variants'
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
import pageListTheme from '@/theme/page-list'

type PageItem = Pick<SceneNode, 'id' | 'name' | 'childIds'>

interface PageActions {
  rename: (pageId: string, name: string) => void
  delete: (pageId: string) => void
  move: (pageId: string, index: number) => void
}

const pageInput = templateRef<HTMLInputElement>('pageInput')
const rename = useInlineRename((id, name) => pageActions.value?.rename(id, name))
const { panels, pages: pageMessages } = useI18n()
const menuCls = useMenuUI({
  content: 'min-w-36 shadow-[0_8px_30px_rgb(0_0_0/0.4)]',
  item: 'justify-start gap-2'
})
const pageListStyles = tv(pageListTheme)
const baseStyles = pageListStyles()

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

function pageDropPosition(pg: PageItem): 'before' | 'after' | undefined {
  if (pageReorder.instructionTargetId.value !== pg.id) return undefined
  if (pageReorder.instruction.value?.operation === 'reorder-before') return 'before'
  if (pageReorder.instruction.value?.operation === 'reorder-after') return 'after'
  return undefined
}

function pageStyles(pg: PageItem, currentPageId: string) {
  return pageListStyles({
    active: pg.id === currentPageId,
    dragging: pageReorder.draggingId.value === pg.id,
    dropPosition: pageDropPosition(pg)
  })
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
    <div data-test-id="pages-panel" :class="baseStyles.panel()">
      <div :class="baseStyles.header()">
        <span data-test-id="pages-header" :class="baseStyles.title()">{{ panels.pages }}</span>
        <Tip :label="panels.addPage">
          <button data-test-id="pages-add" :class="baseStyles.add()" @click="actions.add()">
            +
          </button>
        </Tip>
      </div>
      <div :class="baseStyles.body()">
        <div data-test-id="pages-scroll" :class="baseStyles.viewport()">
          <ContextMenuRoot v-for="pg in pages" :key="pg.id" :modal="false">
            <ContextMenuTrigger as-child>
              <div
                data-test-id="pages-row"
                :ref="(value) => setupPageRowRef(value, pg, pages, actions.move)"
                :class="pageStyles(pg, currentPageId).row()"
                :data-page-id="pg.id"
                :data-active="pg.id === currentPageId || undefined"
                :data-dragging="pageReorder.draggingId.value === pg.id || undefined"
                :data-drop-position="pageDropPosition(pg)"
              >
                <div
                  v-if="pageDropPosition(pg) === 'before'"
                  data-test-id="pages-drop-indicator"
                  :class="pageStyles(pg, currentPageId).dropIndicator()"
                />
                <div
                  v-if="rename.editingId.value === pg.id"
                  :class="pageStyles(pg, currentPageId).renameRow()"
                >
                  <icon-lucide-file :class="pageStyles(pg, currentPageId).icon()" />
                  <input
                    ref="pageInput"
                    data-test-id="pages-item-input"
                    :class="pageStyles(pg, currentPageId).renameInput()"
                    :value="pg.name"
                    @blur="rename.commit(pg.id, $event)"
                    @keydown.stop="rename.onKeydown"
                  />
                </div>
                <div
                  v-else-if="isDivider(pg)"
                  data-test-id="pages-divider"
                  :class="pageStyles(pg, currentPageId).divider()"
                  @dblclick="startRename(pg, actions.rename)"
                >
                  <div :class="pageStyles(pg, currentPageId).dividerLine()" />
                </div>
                <button
                  v-else
                  data-test-id="pages-item"
                  :class="pageStyles(pg, currentPageId).item()"
                  @click="actions.switch(pg.id)"
                  @dblclick="startRename(pg, actions.rename)"
                >
                  <icon-lucide-file :class="pageStyles(pg, currentPageId).icon()" />
                  <span :class="pageStyles(pg, currentPageId).label()">{{ pg.name }}</span>
                </button>
                <div
                  v-if="pageDropPosition(pg) === 'after'"
                  data-test-id="pages-drop-indicator"
                  :class="pageStyles(pg, currentPageId).dropIndicator()"
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
