<script setup lang="ts">
import { computed } from 'vue'

import { useInlineRename } from '@/composables/use-inline-rename'
import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()

const DIVIDER_RE = /^[-–—*\s]+$/

function isDivider(page: { name: string; childIds: string[] }) {
  return page.childIds.length === 0 && DIVIDER_RE.test(page.name)
}

const pages = computed(() => {
  void store.state.sceneVersion
  return store.graph.getPages()
})

const rename = useInlineRename((id, name) => store.renamePage(id, name))

function startRename(pg: { id: string; name: string }) {
  rename.start(pg.id, pg.name, '[data-page-edit]')
}
</script>

<template>
  <div data-test-id="pages-panel" class="flex min-h-0 flex-1 flex-col">
    <div class="flex shrink-0 items-center justify-between px-3 py-1.5">
      <span data-test-id="pages-header" class="text-[11px] uppercase tracking-wider text-muted"
        >Pages</span
      >
      <button
        data-test-id="pages-add"
        class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
        title="Add page"
        @click="store.addPage()"
      >
        +
      </button>
    </div>
    <div class="overflow-x-hidden overflow-y-auto scrollbar-thin px-1 pb-1">
      <div v-for="pg in pages" :key="pg.id">
        <input
          v-if="rename.editingId.value === pg.id"
          data-page-edit
          data-test-id="pages-item-input"
          class="w-full rounded border border-accent bg-input px-2 py-1 text-xs text-surface outline-none"
          :value="pg.name"
          @blur="rename.commit(pg.id, $event.target as HTMLInputElement)"
          @keydown="rename.onKeydown"
        />
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
            pg.id === store.state.currentPageId
              ? 'bg-hover text-surface'
              : 'bg-transparent text-muted hover:bg-hover hover:text-surface'
          "
          @click="store.switchPage(pg.id)"
          @dblclick="startRename(pg)"
        >
          <icon-lucide-file class="size-3 shrink-0" />
          <span class="truncate">{{ pg.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
