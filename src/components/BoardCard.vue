<script setup lang="ts">
import { computed } from 'vue'

import type { Board } from '@/app/api/client'

const { board } = defineProps<{
  board: Board
}>()

const emit = defineEmits<{
  open: [board: Board]
  settings: [board: Board]
  delete: [board: Board]
}>()

const updatedAtLabel = computed(() =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(board.updatedAt)
)
</script>

<template>
  <article
    data-test-id="board-card"
    class="group flex min-h-48 flex-col overflow-hidden rounded-2xl border border-border bg-panel/90 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg"
  >
    <button
      type="button"
      data-test-id="board-open"
      class="flex flex-1 cursor-pointer flex-col justify-between bg-[radial-gradient(circle_at_top_left,rgba(103,149,255,0.22),transparent_45%),linear-gradient(160deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-5 text-left"
      @click="emit('open', board)"
    >
      <div class="flex items-center justify-between gap-3">
        <span class="rounded-full border border-white/10 bg-canvas/60 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted">
          Board
        </span>
        <span class="text-[11px] text-muted">{{ board.collaborators.length }} people</span>
      </div>
      <div class="space-y-2">
        <h2 class="line-clamp-2 text-lg font-semibold text-surface">{{ board.name }}</h2>
        <p class="text-xs text-muted">Updated {{ updatedAtLabel }}</p>
      </div>
    </button>

    <div class="flex items-center justify-between border-t border-border px-4 py-3">
      <button
        type="button"
        data-test-id="board-settings"
        class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="emit('settings', board)"
      >
        Settings
      </button>
      <button
        type="button"
        data-test-id="board-delete"
        class="cursor-pointer rounded-md px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
        @click="emit('delete', board)"
      >
        Delete
      </button>
    </div>
  </article>
</template>
