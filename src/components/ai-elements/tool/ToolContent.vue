<script setup lang="ts">
// Adapted from ai-elements-vue — reka-ui CollapsibleContent
import type { HTMLAttributes } from 'vue'
import { CollapsibleContent } from 'reka-ui'
import { cn } from '../utils'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <CollapsibleContent
    :class="cn(
      'overflow-hidden',
      'data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
      props.class,
    )"
    v-bind="$attrs"
  >
    <slot />
  </CollapsibleContent>
</template>
