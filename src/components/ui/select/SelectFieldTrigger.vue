<script setup lang="ts">
import { SelectTrigger } from 'reka-ui'
import { computed } from 'vue'

import { useSelectFieldTriggerUI } from '@/components/ui/select/field-trigger'
import type { SelectFieldTriggerUI } from '@/components/ui/select/field-trigger'

/**
 * The menu button at the end of a field, inside a select root: a size's Hug and Fill, a line
 * height's Auto. Other attributes, such as `reference`, reach Reka's trigger. A field whose menu
 * is a dropdown styles its own trigger with `useSelectFieldTriggerUI`.
 */
const { label, text, ui } = defineProps<{
  label: string
  /** The chosen mode, when the field's value does not already say it. */
  text?: string
  ui?: SelectFieldTriggerUI
}>()
const styles = computed(() => useSelectFieldTriggerUI({ labelled: Boolean(text) }, ui))
</script>

<template>
  <!-- The field around it scrubs on pointer down and steps on arrow keys; the button does neither. -->
  <SelectTrigger :aria-label="label" :class="styles.root" @pointerdown.stop @keydown.stop>
    <span v-if="text">{{ text }}</span>
    <icon-lucide-chevron-down :class="styles.chevron" />
  </SelectTrigger>
</template>
