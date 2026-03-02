<script setup lang="ts">
// Adapted from ai-elements-vue — vue-stick-to-bottom (same dep)
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { StickToBottom } from 'vue-stick-to-bottom'
import { cn } from '../utils'

interface Props {
  ariaLabel?: string
  class?: HTMLAttributes['class']
  initial?: boolean | 'instant' | { damping?: number; stiffness?: number; mass?: number }
  resize?: 'instant' | { damping?: number; stiffness?: number; mass?: number }
  damping?: number
  stiffness?: number
  mass?: number
  anchor?: 'auto' | 'none'
}

const props = withDefaults(defineProps<Props>(), {
  ariaLabel: 'Conversation',
  initial: true,
  damping: 0.7,
  stiffness: 0.05,
  mass: 1.25,
  anchor: 'none',
})

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <StickToBottom
    v-bind="delegatedProps"
    :class="cn('relative min-h-0 flex-1 overflow-y-hidden', props.class)"
    role="log"
  >
    <slot />
  </StickToBottom>
</template>
