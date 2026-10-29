<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'vccs'
import { computed } from 'vue'

import { formatCount, formatPercent } from '@/app/metrics/format'
import { pooledRetention } from '@/app/metrics/retention'
import type { RetentionCohort } from '@/app/metrics/retention'
import { metricsRetentionTheme } from '@/theme/metrics/dashboard'

const metricsRetention = tv(metricsRetentionTheme)

/**
 * How many installs come back: Day 1, 7, and 30 as numbers, then the whole curve. A day says
 * how long it still needs until some installs are that old.
 */
const { cohorts } = defineProps<{ cohorts: RetentionCohort[] }>()

const ui = metricsRetention()
const points = computed(() =>
  pooledRetention(cohorts).map((point) => ({
    ...point,
    label: point.day === 0 ? 'First day' : `Day ${point.day}`
  }))
)
const HEADLINE_DAYS = [1, 7, 30]
const headline = computed(() =>
  HEADLINE_DAYS.map((day) => {
    const point = points.value.find((candidate) => candidate.day === day)
    return point
      ? { day, value: formatPercent(point.share), empty: false }
      : { day, value: day === 1 ? 'needs 1 day' : `needs ${day} days`, empty: true }
  })
)
const formatShare = (value: unknown) => (typeof value === 'number' ? formatPercent(value) : '')
// The tooltip hands each row back untyped, so the install count is read through a guard.
const installsOf = (row: unknown) =>
  typeof row === 'object' && row !== null && 'installs' in row && typeof row.installs === 'number'
    ? row.installs
    : 0
const tooltipValue = (value: unknown, _name: unknown, item: { payload?: unknown }) =>
  `${formatShare(value)} of ${formatCount(installsOf(item.payload))} installs`
</script>

<template>
  <div :class="ui.root()">
    <dl :class="ui.stats()">
      <div v-for="stat in headline" :key="stat.day" :class="ui.stat()">
        <dt :class="ui.statLabel()">Day {{ stat.day }}</dt>
        <dd :class="ui.statValue()" :data-empty="stat.empty">{{ stat.value }}</dd>
      </div>
    </dl>
    <LineChart
      :data="points"
      :height="180"
      :margin="{ top: 8, right: 8, bottom: 0, left: 0 }"
      :is-animation-active="false"
      class="text-[11px]"
      title="Share of installs that came back, by days since first seen"
    >
      <CartesianGrid :vertical="false" />
      <XAxis data-key="label" :tick-line="false" :axis-line="false" :tick-margin="8" />
      <YAxis
        :width="40"
        :domain="[0, 1]"
        :ticks="[0, 0.25, 0.5, 0.75, 1]"
        :tick-line="false"
        :axis-line="false"
        :tick-formatter="formatShare"
      />
      <Tooltip :formatter="tooltipValue" />
      <Line
        data-key="share"
        name="Came back"
        type="monotone"
        stroke="var(--color-chart-1)"
        :stroke-width="2"
        :dot="{ r: 4, fill: 'var(--color-chart-1)', stroke: 'var(--color-panel)', strokeWidth: 2 }"
      />
    </LineChart>
  </div>
</template>
