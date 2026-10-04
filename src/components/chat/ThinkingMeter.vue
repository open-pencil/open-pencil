<script setup lang="ts">
import { computed } from 'vue'

import type { ThinkingLevel } from '@/app/ai/models/types'
import { chatThinkingTheme } from '@/theme/chat/thinking'

const { level } = defineProps<{ level: ThinkingLevel }>()
const ui = chatThinkingTheme()

/** Bars per level. The provider default fills every bar in grey: the provider decides. */
const FILLED: Record<ThinkingLevel, number> = {
  default: 5,
  off: 0,
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5
}
const BAR_HEIGHTS = ['40%', '55%', '70%', '85%', '100%']
const filled = computed(() => FILLED[level])
</script>

<template>
  <span :class="ui.meter()" :data-level="level" aria-hidden="true" data-slot="thinking-meter">
    <span
      v-for="(height, index) in BAR_HEIGHTS"
      :key="height"
      :class="ui.bar()"
      :data-filled="index < filled"
      :style="{ height }"
    />
  </span>
</template>
