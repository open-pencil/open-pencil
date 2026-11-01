<script setup lang="ts">
import { Primitive } from 'reka-ui'

import SettingsResetButton from './SettingsResetButton.vue'

/**
 * One line of a `SettingsGroup`: a label, an optional description, and its control on the right.
 * As a `label`, clicking the text works the control, as a switch row does. A `modified` row offers
 * Reset to default before its control, emitting `reset`.
 */
const {
  label,
  description,
  as = 'div',
  modified = false
} = defineProps<{
  label?: string
  description?: string
  as?: 'div' | 'label'
  /** The setting differs from its default. */
  modified?: boolean
}>()
const emit = defineEmits<{ reset: [] }>()
</script>

<template>
  <Primitive
    :as="as"
    class="flex items-center justify-between gap-4 px-3 py-2.5"
    data-slot="settings-row"
  >
    <span class="block min-w-0 flex-1">
      <span class="block text-xs font-medium text-surface"
        ><slot name="label">{{ label }}</slot></span
      >
      <span v-if="description" class="mt-1 block text-[11px] leading-relaxed text-muted">{{
        description
      }}</span>
      <slot name="description" />
    </span>
    <span class="flex shrink-0 items-center gap-1">
      <SettingsResetButton v-if="modified" @reset="emit('reset')" />
      <slot />
    </span>
  </Primitive>
</template>
