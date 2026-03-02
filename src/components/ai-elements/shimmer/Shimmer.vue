<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../utils'

export interface ShimmerProps {
  as?: keyof HTMLElementTagNameMap
  class?: HTMLAttributes['class']
  duration?: number
}

const props = withDefaults(defineProps<ShimmerProps>(), {
  as: 'span',
  duration: 2,
})
</script>

<template>
  <component
    :is="props.as"
    :class="cn('animate-shimmer bg-[length:250%_100%] bg-clip-text text-transparent', props.class)"
    :style="{
      backgroundImage: 'linear-gradient(90deg, var(--color-muted) 25%, var(--color-surface) 50%, var(--color-muted) 75%)',
      animationDuration: `${props.duration}s`,
      animationIterationCount: 'infinite',
      animationTimingFunction: 'linear',
    }"
  >
    <slot />
  </component>
</template>

<style scoped>
@keyframes shimmer {
  0% { background-position: 100% center; }
  100% { background-position: -100% center; }
}
.animate-shimmer {
  animation-name: shimmer;
}
</style>
