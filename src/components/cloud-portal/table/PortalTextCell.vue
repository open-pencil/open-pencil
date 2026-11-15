<script setup lang="ts">
import type { Component } from 'vue'

import AppBadge from '@/components/ui/feedback/AppBadge.vue'

import { portalTable } from './ui'

/**
 * A cell of words: a line of text, optionally strong, with an icon or badge beside it, a line under
 * it, and a quotation such as a reason someone gave. `narrowDetail` is a line only a narrow table
 * shows, for a column it hides.
 */
const {
  text,
  icon,
  strong = false,
  badge,
  detail,
  narrowDetail,
  quote
} = defineProps<{
  text?: string | null
  icon?: Component
  strong?: boolean
  badge?: string | null
  detail?: string | null
  narrowDetail?: string | null
  quote?: string | null
}>()
const ui = portalTable()
</script>

<template>
  <div class="flex min-w-0 items-center gap-3">
    <component :is="icon" v-if="icon" class="size-4 shrink-0 text-muted" />
    <div class="min-w-0">
      <p v-if="text" :class="strong ? ui.title() : 'truncate'">
        {{ text }}
        <AppBadge v-if="badge">{{ badge }}</AppBadge>
      </p>
      <p v-if="narrowDetail" :class="[ui.detail(), '@xl/table:hidden']">{{ narrowDetail }}</p>
      <p v-if="detail" :class="ui.detail()">{{ detail }}</p>
      <p v-if="quote" :class="ui.quote()">“{{ quote }}”</p>
    </div>
  </div>
</template>
