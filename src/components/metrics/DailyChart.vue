<script setup lang="ts" generic="Row extends { day: string }">
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis
} from 'vccs'
import { computed } from 'vue'

import { formatCount, formatDay } from '@/app/metrics/format'

import type { Release } from './types'

/** One bar per series per UTC day, in a fixed chart color. */
export interface DailySeries<Key extends string> {
  key: Key
  name: string
  color: string
}

/**
 * A count per UTC day, with series stacked when they add up to a whole and side by side when
 * they don't. Today is still being counted, so its bars are drawn faint. Releases in the range
 * get a marker, so a jump has its cause beside it.
 */
const {
  label,
  days,
  series,
  today,
  releases = [],
  stacked = false,
  height = 240
} = defineProps<{
  /** The chart's accessible name. */
  label: string
  days: Row[]
  series: DailySeries<Extract<keyof Row, string>>[]
  today: string
  releases?: Release[]
  stacked?: boolean
  height?: number
}>()

const dayLabel = (day: string) => (day === today ? 'Today' : formatDay(day))
const rows = computed(() =>
  days.map((day) => ({ ...day, label: dayLabel(day.day), partial: day.day === today }))
)
const markers = computed(() =>
  releases
    .filter((release) => days.some((day) => day.day === release.day))
    .map((release) => ({ ...release, label: dayLabel(release.day) }))
)
const PARTIAL_OPACITY = 0.45
const STACK = 'day'
const formatTick = (value: unknown) =>
  typeof value === 'number' ? formatCount(value) : String(value)
// Stacked bars round only the top segment; side-by-side bars round each one.
const radius = (index: number): [number, number, number, number] =>
  !stacked || index === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
</script>

<template>
  <BarChart
    :data="rows"
    :height="height"
    :margin="{ top: 8, right: 0, bottom: 0, left: 0 }"
    :bar-gap="2"
    :bar-category-gap="stacked ? '10%' : '30%'"
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
    <ReferenceLine
      v-for="marker in markers"
      :key="marker.version"
      :x="marker.label"
      stroke="var(--color-muted)"
      :stroke-width="1"
      :label="{
        value: `v${marker.version}`,
        position: 'insideTopLeft',
        fill: 'var(--color-muted)',
        fontSize: 10
      }"
    />
    <Tooltip :cursor="{ fill: 'var(--color-hover)' }" />
    <Legend :height="28" vertical-align="top" align="right" icon-type="circle" :icon-size="8" />
    <Bar
      v-for="(item, index) in series"
      :key="item.key"
      :data-key="item.key"
      :name="item.name"
      :fill="item.color"
      :stack-id="stacked ? STACK : undefined"
      stroke="var(--color-panel)"
      :stroke-width="stacked ? 2 : 0"
      :radius="radius(index)"
      :max-bar-size="48"
    >
      <Cell v-for="row in rows" :key="row.day" :fill-opacity="row.partial ? PARTIAL_OPACITY : 1" />
    </Bar>
  </BarChart>
</template>
