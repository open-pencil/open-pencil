<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'

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

const editingPageId = ref<string | null>(null)

function startRename(pageId: string) {
  editingPageId.value = pageId
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('[data-page-edit]')
    input?.focus()
    input?.select()
  })
}

function commitRename(pageId: string, input: HTMLInputElement) {
  if (editingPageId.value !== pageId) return
  const value = input.value.trim()
  if (value && value !== store.graph.getNode(pageId)?.name) {
    store.renamePage(pageId, value)
  }
  editingPageId.value = null
}

function onKeydown(e: KeyboardEvent, pageId: string) {
  if (e.key === 'Enter' || e.key === 'Escape') {
    ;(e.target as HTMLInputElement).blur()
  }
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
    <div class="overflow-x-hidden overflow-y-auto px-1 pb-1">
      <div v-for="pg in pages" :key="pg.id">
        <input
          v-if="editingPageId === pg.id"
          data-page-edit
          data-test-id="pages-item-input"
          class="w-full rounded border border-accent bg-input px-2 py-1 text-xs text-surface outline-none"
          :value="pg.name"
          @blur="commitRename(pg.id, $event.target as HTMLInputElement)"
          @keydown="onKeydown($event, pg.id)"
        />
        <div
          v-else-if="isDivider(pg)"
          class="my-1 flex items-center px-2"
          @dblclick="startRename(pg.id)"
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
          @dblclick="startRename(pg.id)"
        >
          <icon-lucide-file class="size-3 shrink-0" />
          <span class="truncate">{{ pg.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
