<script lang="ts">
import type { VNode } from 'vue'
import type { ClassValue } from 'tailwind-variants'

import type { PanelRowTheme } from '@/theme/panel/row'

export interface PanelRowProps {
  cols?: keyof PanelRowTheme['variants']['columns']
  gap?: keyof PanelRowTheme['variants']['gap']
  class?: ClassValue
}

export interface PanelRowSlots {
  default(): VNode[]
}
</script>

<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/panel/row'

/** @deprecated Prefer PanelGrid for new property-panel layouts. */
const { cols = 'auto', gap = 'md', class: className } = defineProps<PanelRowProps>()
defineSlots<PanelRowSlots>()
const panelRow = tv(theme)
</script>

<template>
  <div :class="panelRow({ columns: cols, gap, class: className })">
    <slot />
  </div>
</template>
