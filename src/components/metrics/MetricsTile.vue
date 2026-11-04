<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { Sparkline } from 'vccs'
import { computed } from 'vue'

import { formatChange, formatCount } from '@/app/metrics/format'
import { metricsTileTheme } from '@/theme/metrics/dashboard'

const metricsTile = tv(metricsTileTheme)

/**
 * A headline number, how it changed over the chosen days, and a bar for each of those days. A
 * number nothing has recorded yet shows as a dash.
 */
const { label, value, change, detail, trend } = defineProps<{
  label: string
  value: number | null
  change?: number
  detail?: string
  trend?: number[]
}>()

const ui = metricsTile()
const direction = computed(() => {
  if (!change) return 'flat'
  return change > 0 ? 'up' : 'down'
})
</script>

<template>
  <div :class="ui.root()">
    <span :class="ui.label()">{{ label }}</span>
    <span :class="ui.value()">{{ value === null ? '—' : formatCount(value) }}</span>
    <span :class="ui.detail()">
      <span v-if="change !== undefined" :class="ui.change()" :data-direction="direction">
        {{ formatChange(change) }}
      </span>
      <span v-if="detail">{{ detail }}</span>
    </span>
    <Sparkline
      v-if="trend?.length"
      :class="ui.trend()"
      :data="trend"
      type="bar"
      :height="32"
      :is-animation-active="false"
      :value-formatter="formatCount"
      :title="`${label}, ${trend.length} days`"
    />
  </div>
</template>
