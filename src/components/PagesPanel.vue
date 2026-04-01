<script setup lang="ts">
import { ref } from 'vue'

import { PageListRoot, useI18n, useInlineRename } from '@open-pencil/vue'

import Tip from '@/components/ui/Tip.vue'

const pageInputRefs = new Map<string, HTMLInputElement>()
const activeRenameId = ref<string | null>(null)
const rename = useInlineRename((id, name) => pageActions.value?.renamePage(id, name))
const { panels } = useI18n()

const pageActions = ref<{
  renamePage: (pageId: string, name: string) => void
} | null>(null)

function setPageActions(renamePage: (pageId: string, name: string) => void) {
  pageActions.value = { renamePage }
}

function setPageInputRef(pageId: string, el: HTMLInputElement | null) {
  if (el) pageInputRefs.set(pageId, el)
  else pageInputRefs.delete(pageId)

  if (el && activeRenameId.value === pageId) {
    activeRenameId.value = null
    void rename.focusInput(el)
  }
}

function startRename(pg: { id: string; name: string }) {
  rename.start(pg.id, pg.name)
  activeRenameId.value = pg.id
}

function handlePageDblClick(
  pg: { id: string; name: string },
  renamePage: (pageId: string, name: string) => void
) {
  setPageActions(renamePage)
  startRename(pg)
}
</script>

<template>
  <PageListRoot v-slot="{ pages, currentPageId, isDivider, addPage, switchPage, renamePage }">
    <div data-test-id="pages-panel" class="flex min-h-0 flex-1 flex-col">
      <div class="flex shrink-0 items-center justify-between px-3 py-1.5">
        <span data-test-id="pages-header" class="text-[11px] tracking-wider text-muted uppercase">{{
          panels.pages
        }}</span>
        <Tip :label="panels.addPage">
          <button
            data-test-id="pages-add"
            class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
            @click="addPage()"
          >
            +
          </button>
        </Tip>
      </div>
      <div class="scrollbar-thin overflow-x-hidden overflow-y-auto px-1 pb-1">
        <div v-for="pg in pages" :key="pg.id">
          <div
            v-if="rename.editingId.value === pg.id"
            class="flex w-full items-center gap-1.5 rounded px-2 py-1"
          >
            <icon-lucide-file class="size-3 shrink-0 opacity-70" />
            <input
              :ref="(el) => setPageInputRef(pg.id, el as HTMLInputElement | null)"
              data-test-id="pages-item-input"
              class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0 text-xs text-surface outline-none"
              :value="pg.name"
              @blur="rename.commit(pg.id, $event.target as HTMLInputElement)"
              @keydown.stop="rename.onKeydown"
            />
          </div>
          <div
            v-else-if="isDivider(pg)"
            class="my-1 flex items-center px-2"
            @dblclick="startRename(pg)"
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
            @click="switchPage(pg.id)"
            @dblclick="handlePageDblClick(pg, renamePage)"
          >
            <icon-lucide-file class="size-3 shrink-0" />
            <span class="truncate">{{ pg.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </PageListRoot>
</template>
