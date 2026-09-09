<script setup lang="ts">
import { TabsTrigger } from 'reka-ui'
import { normalizeClass, type HTMLAttributes } from 'vue'

import { tabs } from '@/theme/tabs/tabs'

const {
  value,
  disabled,
  class: className,
  ui
} = defineProps<{
  class?: HTMLAttributes['class']
  value: string
  disabled?: boolean
  ui?: { trigger?: string; icon?: string; label?: string; trailing?: string }
}>()
const styles = tabs()
</script>

<template>
  <TabsTrigger
    :value="value"
    :disabled="disabled"
    data-slot="trigger"
    :class="styles.trigger({ class: [ui?.trigger, normalizeClass(className)] })"
  >
    <span v-if="$slots.leading" data-slot="leading" :class="styles.icon({ class: ui?.icon })"
      ><slot name="leading"
    /></span>
    <span data-slot="label" :class="styles.label({ class: ui?.label })"><slot /></span>
    <span
      v-if="$slots.trailing"
      data-slot="trailing"
      :class="styles.trailing({ class: ui?.trailing })"
      ><slot name="trailing"
    /></span>
  </TabsTrigger>
</template>
