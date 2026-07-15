<script lang="ts">
import type { VNode } from 'vue'
import type { ClassValue } from 'tailwind-variants'

import type { PanelGridTheme } from '@/theme/panel/grid'
type PanelGridColumns = keyof PanelGridTheme['variants']['columns']

export interface PanelGridProps {
  columns?: PanelGridColumns
  class?: ClassValue
}

export interface PanelGridSlots {
  default(): VNode[]
}
</script>

<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/panel/grid'

const { columns = 'two-rail', class: className } = defineProps<PanelGridProps>()
defineSlots<PanelGridSlots>()
const panelGrid = tv(theme)
</script>

<template>
  <div
    data-slot="root"
    data-panel-grid
    :data-columns="columns"
    :class="panelGrid({ columns, class: className })"
  >
    <slot />
  </div>
</template>
