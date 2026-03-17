<script setup lang="ts">
import { useScrubInput } from './context'

const ctx = useScrubInput()
</script>

<template>
  <input
    v-if="ctx.editing.value"
    :ref="(el) => { ctx.inputRef.value = el as HTMLInputElement | null }"
    type="number"
    :value="ctx.isMixed.value ? '' : ctx.displayValue.value"
    v-bind="$attrs"
    @blur="ctx.commitEdit"
    @keydown="ctx.onKeydown"
  />
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
