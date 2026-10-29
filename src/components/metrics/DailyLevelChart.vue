<script setup lang="ts" generic="Row extends { day: string }">
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'vccs'
import { computed } from 'vue'

import { formatCount, formatDay } from '@/app/metrics/format'

import type { DailySeries } from './DailyChart.vue'

/**
 * A level at the end of each UTC day, such as how many issues were open, with series stacked
 * so the top edge is the total. Levels are read as change over time, so they are areas rather
 * than the bars `DailyChart` draws for per-day counts.
 */
const {
  label,
  days,
  series,
  height = 200
} = defineProps<{
  /** The chart's accessible name. */
  label: string
  days: Row[]
  series: DailySeries<Extract<keyof Row, string>>[]
  height?: number
}>()

const rows = computed(() => days.map((day) => ({ ...day, label: formatDay(day.day) })))
const STACK = 'level'
const FILL_OPACITY = 0.25
const formatTick = (value: unknown) =>
  typeof value === 'number' ? formatCount(value) : String(value)
</script>

<template>
  <AreaChart
    :data="rows"
    :height="height"
    :margin="{ top: 8, right: 0, bottom: 0, left: 0 }"
    :is-animation-active="false"
    class="text-[11px]"
    :title="label"
  >
    <CartesianGrid :vertical="false" />
    <XAxis data-key="label" :tick-line="false" :axis-line="false" :tick-margin="8" />
    <YAxis
      :width="40"
      :tick-line="false"
      :axis-line="false"
      :tick-formatter="formatTick"
      :allow-decimals="false"
    />
    <Tooltip :cursor="{ stroke: 'var(--color-border)' }" />
    <Legend :height="28" vertical-align="top" align="right" icon-type="circle" :icon-size="8" />
    <Area
      v-for="item in series"
      :key="item.key"
      :data-key="item.key"
      :name="item.name"
      type="linear"
      :stack-id="STACK"
      :stroke="item.color"
      :stroke-width="2"
      :fill="item.color"
      :fill-opacity="FILL_OPACITY"
      :is-animation-active="false"
    />
  </AreaChart>
</template>
