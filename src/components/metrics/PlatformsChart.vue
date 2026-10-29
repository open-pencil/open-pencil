<script setup lang="ts">
import { Bar, BarChart, Legend, Tooltip, XAxis, YAxis } from 'vccs'
import { computed } from 'vue'

import { formatOS } from '@/app/metrics/format'

import type { PlatformCount } from './types'

/**
 * One row per OS, desktop and web stacked in the installs chart's colors, so each OS reads as a
 * whole and as its two parts.
 */
const { platforms } = defineProps<{ platforms: PlatformCount[] }>()

const rows = computed(() =>
  platforms
    .map((platform) => ({ ...platform, os: formatOS(platform.os) }))
    .toSorted((a, b) => b.desktop + b.web - (a.desktop + a.web))
)
const ROW_HEIGHT = 32
const LEGEND_HEIGHT = 28
const height = computed(() => rows.value.length * ROW_HEIGHT + LEGEND_HEIGHT)
</script>

<template>
  <BarChart
    :data="rows"
    layout="vertical"
    :height="height"
    :margin="{ top: 0, right: 0, bottom: 0, left: 0 }"
    :bar-category-gap="6"
    :is-animation-active="false"
    class="text-[11px]"
    title="Daily pings by OS, desktop and web"
  >
    <XAxis type="number" hide />
    <YAxis type="category" data-key="os" :width="64" :tick-line="false" :axis-line="false" />
    <Tooltip :cursor="{ fill: 'var(--color-hover)' }" />
    <Legend
      :height="LEGEND_HEIGHT"
      vertical-align="top"
      align="right"
      icon-type="circle"
      :icon-size="8"
    />
    <Bar
      data-key="desktop"
      name="Desktop"
      stack-id="os"
      fill="var(--color-chart-1)"
      stroke="var(--color-panel)"
      :stroke-width="2"
    />
    <Bar
      data-key="web"
      name="Web"
      stack-id="os"
      fill="var(--color-chart-2)"
      stroke="var(--color-panel)"
      :stroke-width="2"
      :radius="[0, 4, 4, 0]"
    />
  </BarChart>
</template>
