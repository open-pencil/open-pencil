<script setup lang="ts">
// Identical logic to ai-elements-vue — pure layout wrapper
import type { HTMLAttributes } from 'vue'
import { cn } from '../utils'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div :class="cn('flex flex-col gap-4 p-3', props.class)">
    <slot />
  </div>
</template>
