<script setup lang="ts">
// Adapted from ai-elements-vue — reka-ui CollapsibleRoot
import type { HTMLAttributes } from 'vue'
import { CollapsibleRoot } from 'reka-ui'
import { cn } from '../utils'

interface Props {
  class?: HTMLAttributes['class']
  open?: boolean
  defaultOpen?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()
</script>

<template>
  <CollapsibleRoot
    :open="props.open"
    :default-open="props.defaultOpen"
    :class="cn('group not-prose mb-1 w-full rounded-lg border border-border bg-canvas', props.class)"
    v-bind="$attrs"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </CollapsibleRoot>
</template>
