<script lang="ts">
import type { ClassValue } from 'tailwind-variants'
import type { VNode } from 'vue'

import type { ComponentUI } from '@/components/ui/types'
import type theme from '@/theme/panel/item-row'

export type PanelItemRowUI = ComponentUI<typeof theme>

export interface PanelItemRowProps {
  class?: ClassValue
  ui?: PanelItemRowUI
}

export interface PanelItemRowSlots {
  default(): VNode[]
  rail?(props: { removeClass: string }): VNode[]
  details?(): VNode[]
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import itemRowTheme from '@/theme/panel/item-row'

const { class: className, ui } = defineProps<PanelItemRowProps>()
defineSlots<PanelItemRowSlots>()
const styles = computed(() => tv(itemRowTheme)())
</script>

<template>
  <div data-slot="item-row" :class="styles.root({ class: [ui?.root, className] })">
    <div :class="styles.content({ class: ui?.content })" data-slot="content">
      <slot />
    </div>
    <div v-if="$slots.rail" :class="styles.rail({ class: ui?.rail })" data-slot="rail">
      <slot name="rail" :remove-class="styles.remove({ class: ui?.remove })" />
    </div>
    <div v-if="$slots.details" :class="styles.details({ class: ui?.details })" data-slot="details">
      <slot name="details" />
    </div>
  </div>
</template>
