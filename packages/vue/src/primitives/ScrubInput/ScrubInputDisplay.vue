<script setup lang="ts">
import { useScrubInput } from '#vue/primitives/ScrubInput/context'

const ctx = useScrubInput()
</script>

<template>
  <span v-if="!ctx.editing.value" v-bind="$attrs">
    <slot :value="ctx.displayValue.value" :is-mixed="ctx.isMixed.value" :placeholder="''">
      {{ ctx.isMixed.value ? '' : ctx.displayValue.value }}
    </slot>
  </span>
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
