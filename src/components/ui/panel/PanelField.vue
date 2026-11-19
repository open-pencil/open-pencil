<script lang="ts">
import type { ClassValue } from 'tailwind-variants'
import type { VNode } from 'vue'

import type { ComponentUI } from '@/components/ui/types'
import type { PanelFieldShellTheme } from '@/theme/panel/field/shell'

export interface PanelFieldProps {
  class?: ClassValue
  ui?: ComponentUI<PanelFieldShellTheme>
}

export interface PanelFieldSlots {
  /** An icon naming the field, as a number field's leading icon. */
  leading?(): VNode[]
  default(): VNode[]
  /** The field's own controls, such as a `SelectFieldTrigger`. */
  trailing?(): VNode[]
}
</script>

<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import theme from '@/theme/panel/field/shell'

/** The frame of a panel field whose value is not a number field: see `theme/panel/field/shell`. */
const { class: className, ui } = defineProps<PanelFieldProps>()
const slots = defineSlots<PanelFieldSlots>()
const styles = computed(() =>
  tv(theme)({ leading: Boolean(slots.leading), trailing: Boolean(slots.trailing) })
)
</script>

<template>
  <div data-slot="root" :class="styles.root({ class: [ui?.root, className] })">
    <span v-if="slots.leading" data-slot="leading" :class="styles.leading({ class: ui?.leading })">
      <slot name="leading" />
    </span>
    <span data-slot="value" :class="styles.value({ class: ui?.value })">
      <slot />
    </span>
    <span
      v-if="slots.trailing"
      data-slot="trailing"
      :class="styles.trailing({ class: ui?.trailing })"
    >
      <slot name="trailing" />
    </span>
  </div>
</template>
