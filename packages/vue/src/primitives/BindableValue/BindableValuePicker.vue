<script setup lang="ts">
import { ComboboxRoot } from 'reka-ui'

import { useBindableValue } from '#vue/primitives/BindableValue/context'

const ctx = useBindableValue()

function select(value: unknown) {
  if (typeof value !== 'object' || value === null || !('id' in value)) return
  if (typeof value.id !== 'string') return
  ctx.actions.bind(value.id)
}
</script>

<template>
  <ComboboxRoot
    :open="ctx.open.value"
    :model-value="ctx.variable.value"
    :ignore-filter="true"
    @update:model-value="select"
    @update:open="(open: boolean) => (open ? ctx.actions.openPicker() : ctx.actions.closePicker())"
  >
    <slot v-bind="ctx.slotProps.value" />
  </ComboboxRoot>
</template>
