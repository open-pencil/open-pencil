<script setup lang="ts">
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

import { settingsTheme } from '@open-pencil/theme'

import SettingsResetButton from './SettingsResetButton.vue'

const ui = tv(settingsTheme)()

/**
 * One line of a `SettingsGroup`: a label, an optional description, and its control on the right.
 * As a `label`, clicking the row works the control, as a switch row does. A `modified` row offers
 * Reset to default beside its control, emitting `reset`.
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
  <Primitive :as="as" :class="ui.row()" data-slot="settings-row">
    <span :class="ui.rowText()">
      <span :class="ui.rowLabel()"
        ><slot name="label">{{ label }}</slot></span
      >
      <span v-if="description" :class="ui.rowDescription()">{{ description }}</span>
      <slot name="description" />
    </span>
    <span :class="ui.rowControl()">
      <slot />
      <!-- After the control, so a label row's control is the setting's own, its first labelable
           element, and Reset reads after the setting it resets; shown before the control. -->
      <SettingsResetButton
        v-if="modified"
        class="order-first"
        :disabled="resetDisabled"
        @reset="emit('reset')"
      />
    </span>
  </Primitive>
</template>
