<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { templateRef } from '@vueuse/core'

import { useNumberField } from '#vue/primitives/NumberField/context'

const ctx = useNumberField()
const inputEl = templateRef<HTMLInputElement>('inputEl')

const ariaAttrs = computed(() => ({
  role: 'spinbutton' as const,
  'aria-valuenow': ctx.isMixed.value ? undefined : ctx.numericValue.value,
  'aria-valuemin': Number.isFinite(ctx.min.value) ? ctx.min.value : undefined,
  'aria-valuemax': Number.isFinite(ctx.max.value) ? ctx.max.value : undefined,
  'aria-disabled': ctx.disabled.value ? ('true' as const) : undefined,
  'aria-label': ctx.ariaLabel.value
}))

watchEffect(() => {
  ctx.inputRef.value = inputEl.value
})

defineOptions({ inheritAttrs: false })
</script>

<template>
  <input
    v-if="ctx.editing.value"
    ref="inputEl"
    v-bind="{ ...$attrs, ...ctx.stateAttrs.value, ...ariaAttrs }"
    data-slot="input"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    :spellcheck="false"
    :disabled="ctx.disabled.value"
    :value="ctx.draftValue.value"
    @blur="ctx.actions.commitEdit"
    @keydown.stop="ctx.actions.keydown"
    @input="ctx.actions.input"
  />
</template>
