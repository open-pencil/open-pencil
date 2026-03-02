<script setup lang="ts">
// Adapted from ai-elements-vue — reka-ui + lucide-vue-next
import type { HTMLAttributes } from 'vue'
import { CollapsibleTrigger } from 'reka-ui'
import { BrainIcon, ChevronDownIcon } from 'lucide-vue-next'
import { computed } from 'vue'
import { cn } from '../utils'
import { Shimmer } from '../shimmer'
import { useReasoningContext } from './context'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const { isStreaming, isOpen, duration } = useReasoningContext()

const thinkingMessage = computed(() => {
  if (isStreaming.value || duration.value === 0) return 'thinking'
  if (duration.value === undefined) return 'default_done'
  return 'duration_done'
})
</script>

<template>
  <CollapsibleTrigger
    :class="cn(
      'flex w-full items-center gap-2 text-muted text-[11px] transition-colors hover:text-surface cursor-pointer',
      props.class,
    )"
  >
    <slot>
      <BrainIcon class="size-3.5 text-accent/70" />

      <template v-if="thinkingMessage === 'thinking'">
        <Shimmer :duration="1.5">Thinking...</Shimmer>
      </template>
      <template v-else-if="thinkingMessage === 'default_done'">
        <span>Thought for a few seconds</span>
      </template>
      <template v-else>
        <span>Thought for {{ duration }}s</span>
      </template>

      <ChevronDownIcon
        :class="cn('size-3 transition-transform ml-auto', isOpen ? 'rotate-180' : 'rotate-0')"
      />
    </slot>
  </CollapsibleTrigger>
</template>
