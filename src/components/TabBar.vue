<script setup lang="ts">
import { useTabsStore, createTab } from '@/stores/tabs'

const { tabs, switchTab, closeTab } = useTabsStore()

function onMiddleClick(e: MouseEvent, tabId: string) {
  if (e.button === 1) {
    e.preventDefault()
    closeTab(tabId)
  }
}

function onClose(e: MouseEvent, tabId: string) {
  e.stopPropagation()
  closeTab(tabId)
}
</script>

<template>
  <div
    v-if="tabs.length > 1"
    class="flex h-9 shrink-0 items-end gap-0 overflow-x-auto border-b border-border bg-panel scrollbar-none"
  >
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="group/tab flex h-full max-w-48 min-w-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs transition-colors select-none"
      :class="
        tab.isActive
          ? 'bg-surface text-surface'
          : 'bg-panel text-muted hover:bg-hover hover:text-surface'
      "
      @click="switchTab(tab.id)"
      @mousedown="onMiddleClick($event, tab.id)"
    >
      <icon-lucide-file class="size-3 shrink-0 opacity-50" />
      <span class="min-w-0 flex-1 truncate">{{ tab.name }}</span>
      <button
        class="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity hover:bg-hover group-hover/tab:opacity-100"
        :class="tab.isActive ? 'opacity-100' : ''"
        title="Close tab"
        @click="onClose($event, tab.id)"
      >
        <icon-lucide-x class="size-3" />
      </button>
    </div>
    <button
      class="flex size-9 shrink-0 cursor-pointer items-center justify-center text-muted transition-colors hover:bg-hover hover:text-surface"
      title="New tab"
      @click="createTab()"
    >
      <icon-lucide-plus class="size-3.5" />
    </button>
  </div>
</template>
