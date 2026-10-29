<script setup lang="ts">
import { portalTable } from './ui'

/**
 * Where a row stands, as coloured badges, or `fallback` in plain words when no badge applies, with
 * a line under them such as why.
 */
const { statuses, fallback, detail } = defineProps<{
  statuses: readonly { label: string; tone: 'neutral' | 'success' | 'warning' | 'error' }[]
  fallback?: string
  detail?: string | null
}>()
const ui = portalTable()
</script>

<template>
  <div class="flex min-w-0 flex-col items-start gap-0.5">
    <div v-if="statuses.length" class="flex flex-wrap items-center gap-1">
      <span
        v-for="status in statuses"
        :key="status.label"
        :class="ui.status()"
        :data-tone="status.tone"
      >
        {{ status.label }}
      </span>
    </div>
    <span v-else-if="fallback" class="text-muted">{{ fallback }}</span>
    <span v-if="detail" :class="ui.detail()">{{ detail }}</span>
  </div>
</template>
