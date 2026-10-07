<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { useId } from 'vue'

import type { ComponentUI } from '@/components/ui/types'
import theme from '@/theme/toggle/checkbox-card'

import AppCheckbox from './AppCheckbox.vue'

/** A checkbox choice whose whole card toggles it, named by its label and described by its text. */
const {
  label,
  description,
  disabled = false,
  ui
} = defineProps<{
  label: string
  description?: string
  disabled?: boolean
  ui?: ComponentUI<typeof theme>
}>()
const checked = defineModel<boolean>({ required: true })
const styles = tv(theme)()
const id = useId()
</script>

<template>
  <!-- The whole card is the control, so its description is disabled along with the checkbox. -->
  <label
    data-slot="checkbox-card"
    :aria-disabled="disabled || undefined"
    :class="styles.root({ class: ui?.root })"
  >
    <AppCheckbox
      v-model="checked"
      :disabled="disabled"
      :ariaLabelledby="`${id}-label`"
      :ariaDescribedby="description ? `${id}-description` : undefined"
    />
    <slot name="icon" />
    <span :class="styles.text({ class: ui?.text })">
      <span :id="`${id}-label`" :class="styles.label({ class: ui?.label })">{{ label }}</span>
      <span
        v-if="description"
        :id="`${id}-description`"
        :class="styles.description({ class: ui?.description })"
      >
        {{ description }}
      </span>
    </span>
  </label>
</template>
