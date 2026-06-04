<script setup lang="ts">
import { computed } from 'vue'

import { colorToCSS } from '@inkly/core/color'

import { colorFromAnonymousId } from '@/app/collab/cursor-color'
import type { Board } from '@/app/api/client'

const { board, previewUrl = null } = defineProps<{
  board: Board
  previewUrl?: string | null
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

const collaboratorAvatars = computed(() =>
  board.collaborators.slice(0, 3).map((collaborator) => ({
    anonymousId: collaborator.anonymousId,
    initials: collaborator.anonymousId.replace(/[^a-z0-9]+/gi, '').slice(0, 2).toUpperCase() || 'AN',
    color: colorToCSS(colorFromAnonymousId(collaborator.anonymousId))
  }))
)

const hiddenCollaboratorCount = computed(() => Math.max(board.collaborators.length - 3, 0))
</script>

<template>
  <article
    data-test-id="board-card"
    class="group flex min-h-56 flex-col overflow-hidden rounded-2xl border border-border bg-panel/90 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg"
  >
    <button
      type="button"
      data-test-id="board-open"
      class="flex flex-1 cursor-pointer flex-col justify-between bg-[radial-gradient(circle_at_top_left,rgba(103,149,255,0.22),transparent_45%),linear-gradient(160deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-5 text-left"
      @click="emit('open', board)"
    >
      <div
        class="mb-4 overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]"
      >
        <img
          v-if="previewUrl"
          :src="previewUrl"
          :alt="`${board.name} preview`"
          data-test-id="board-preview-image"
          class="h-32 w-full object-cover"
        />
        <div
          v-else
          data-test-id="board-preview-placeholder"
          class="flex h-32 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(126,164,255,0.18),transparent_50%),linear-gradient(180deg,rgba(11,15,24,0.35),rgba(11,15,24,0.8))] text-xs uppercase tracking-[0.2em] text-muted"
        >
          Preview pending
        </div>
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="rounded-full border border-white/10 bg-canvas/60 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted">
          Board
        </span>
        <div class="flex items-center gap-2">
          <div class="flex -space-x-2">
            <div
              v-for="avatar in collaboratorAvatars"
              :key="avatar.anonymousId"
              data-test-id="board-collaborator-avatar"
              :title="avatar.anonymousId"
              :style="{ background: avatar.color }"
              class="flex size-7 items-center justify-center rounded-full border border-canvas text-[10px] font-semibold text-white shadow-sm"
            >
              {{ avatar.initials }}
            </div>
            <div
              v-if="hiddenCollaboratorCount > 0"
              data-test-id="board-collaborator-overflow"
              class="flex size-7 items-center justify-center rounded-full border border-canvas bg-canvas text-[10px] font-semibold text-muted"
            >
              +{{ hiddenCollaboratorCount }}
            </div>
          </div>
          <span class="text-[11px] text-muted">{{ board.collaborators.length }} people</span>
        </div>
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
