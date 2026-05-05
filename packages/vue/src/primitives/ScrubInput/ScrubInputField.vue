<script setup lang="ts">
import { templateRef } from '@vueuse/core'
import { watchEffect } from 'vue'

import { useScrubInput } from '#vue/primitives/ScrubInput/context'

const ctx = useScrubInput()
const inputEl = templateRef<HTMLInputElement>('inputEl')

watchEffect(() => {
  ctx.inputRef.value = inputEl.value
})
</script>

<template>
  <input
    v-if="ctx.editing.value"
    ref="inputEl"
    type="number"
    :value="ctx.isMixed.value ? '' : ctx.displayValue.value"
    v-bind="$attrs"
    @blur="ctx.commitEdit"
    @keydown="ctx.onKeydown"
    @input="ctx.liveUpdate"
  />
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
