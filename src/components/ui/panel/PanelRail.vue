<script lang="ts">
import type { VNode } from 'vue'
import type { ClassValue } from 'tailwind-variants'

export interface PanelRailProps {
  class?: ClassValue
}

export interface PanelRailSlots {
  default(): VNode[]
}
</script>

<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/panel/rail'

const { class: className } = defineProps<PanelRailProps>()
defineSlots<PanelRailSlots>()
const panelRail = tv(theme)
</script>

<template>
  <div data-slot="root" data-panel-rail :class="panelRail({ class: className })">
    <slot />
  </div>
</template>
