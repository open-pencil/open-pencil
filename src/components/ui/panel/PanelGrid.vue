<script lang="ts">
import type { ClassValue } from 'tailwind-variants'

import type { PropertyGridRootSlots } from '@open-pencil/vue'

export interface PanelGridProps {
  columns?: 1 | 2 | 3
  distribution?: 'equal' | 'wide-first'
  class?: ClassValue
}

export type PanelGridSlots = PropertyGridRootSlots
</script>

<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { PropertyGridRoot } from '@open-pencil/vue'

import theme from '@/theme/panel/grid'

const { columns = 1, distribution = 'equal', class: className } = defineProps<PanelGridProps>()
defineSlots<PanelGridSlots>()
const panelGrid = tv(theme)
</script>

<template>
  <PropertyGridRoot
    :columns="columns"
    :distribution="distribution"
    :class="panelGrid({ columns, distribution, class: className })"
  >
    <slot />
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
  </PropertyGridRoot>
</template>
