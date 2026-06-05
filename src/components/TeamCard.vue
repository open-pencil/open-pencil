<script setup lang="ts">
import { computed } from 'vue'

import type { TeamSummary } from '@/app/api/teams'

const { team } = defineProps<{
  team: TeamSummary
}>()

const emit = defineEmits<{
  open: [team: TeamSummary]
  settings: [team: TeamSummary]
}>()

const updatedAtLabel = computed(() =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(team.updatedAt)
)

const roleLabel = computed(() => team.role[0].toUpperCase() + team.role.slice(1))
</script>

<template>
  <article
    data-test-id="team-card"
    class="group flex min-h-48 flex-col overflow-hidden rounded-2xl border border-border bg-panel/90 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg"
  >
    <button
      type="button"
      data-test-id="team-card-open"
      class="flex flex-1 cursor-pointer flex-col justify-between bg-[radial-gradient(circle_at_top_left,rgba(255,180,92,0.2),transparent_42%),linear-gradient(155deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-5 text-left"
      @click="emit('open', team)"
    >
      <div class="flex items-start justify-between gap-3">
        <span
          class="rounded-full border border-white/10 bg-canvas/60 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted"
        >
          {{ roleLabel }}
        </span>
        <span class="text-[11px] text-muted">{{ team.memberCount }} members</span>
      </div>

      <div class="space-y-2">
        <h2 class="line-clamp-2 text-xl font-semibold text-surface">{{ team.name }}</h2>
        <p class="text-xs text-muted">{{ team.boardCount }} boards · Updated {{ updatedAtLabel }}</p>
      </div>
    </button>

    <div class="flex items-center justify-between border-t border-border px-4 py-3">
      <button
        type="button"
        class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="emit('open', team)"
      >
        Open
      </button>
      <button
        type="button"
        data-test-id="team-card-settings"
        class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
        @click="emit('settings', team)"
      >
        Settings
      </button>
    </div>
  </article>
</template>
