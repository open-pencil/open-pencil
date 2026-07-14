<script setup lang="ts">
import { useNumberField } from '#vue/primitives/NumberField/context'
import type { NumberFieldValueSlots } from '#vue/primitives/NumberField/types'

const ctx = useNumberField()
defineSlots<NumberFieldValueSlots>()
defineOptions({ inheritAttrs: false })
</script>

<template>
  <span v-if="!ctx.editing.value" v-bind="{ ...$attrs, ...ctx.stateAttrs.value }" data-slot="value">
    <slot v-bind="ctx.slotProps.value" :value="ctx.displayValue.value">
      {{ ctx.isMixed.value ? ctx.slotProps.value.placeholder : ctx.displayValue.value }}
    </slot>
  </span>
</template>
