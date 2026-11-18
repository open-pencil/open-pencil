<script setup lang="ts">
import { Primitive } from 'reka-ui'

import SettingsResetButton from './SettingsResetButton.vue'

/**
 * One line of a `SettingsGroup`: a label, an optional description, and its control on the right.
 * As a `label`, clicking the text works the control, as a switch row does. A `modified` row offers
 * Reset to default before its control, emitting `reset`, outside the label so the text still works
 * the control.
 */
const {
  label,
  description,
  as = 'div',
  modified = false,
  resetDisabled = false
} = defineProps<{
  label?: string
  description?: string
  as?: 'div' | 'label'
  /** The setting differs from its default. */
  modified?: boolean
  /** The setting can't change right now; pass what disables its control. */
  resetDisabled?: boolean
}>()
const emit = defineEmits<{ reset: [] }>()
</script>

<template>
  <div class="flex items-center gap-1 px-3 py-2.5" data-slot="settings-row">
    <!-- Reset stays out of the label, whose control is then the setting's own rather than the
         first button in it; `order` still shows it between the text and the control. -->
    <SettingsResetButton
      v-if="modified"
      class="order-2"
      :disabled="resetDisabled"
      @reset="emit('reset')"
    />
    <Primitive :as="as" class="contents">
      <span class="order-1 me-3 block min-w-0 flex-1">
        <span class="block text-xs font-medium text-surface"
          ><slot name="label">{{ label }}</slot></span
        >
        <span v-if="description" class="mt-1 block text-2xs leading-relaxed text-muted">{{
          description
        }}</span>
        <slot name="description" />
      </span>
      <span class="order-3 flex shrink-0 items-center"><slot /></span>
    </Primitive>
  </div>
</template>
