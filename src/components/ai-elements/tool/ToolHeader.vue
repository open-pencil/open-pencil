<script setup lang="ts">
// Adapted from ai-elements-vue — reka-ui + lucide-vue-next
import type { DynamicToolUIPart, ToolUIPart } from 'ai'
import type { HTMLAttributes } from 'vue'
import { CollapsibleTrigger } from 'reka-ui'
import { ChevronDownIcon, WrenchIcon } from 'lucide-vue-next'
import { computed } from 'vue'
import { cn } from '../utils'
import ToolStatusBadge from './ToolStatusBadge.vue'

type ToolHeaderProps = {
  title?: string
  class?: HTMLAttributes['class']
} & (
  | { type: ToolUIPart['type']; state: ToolUIPart['state']; toolName?: never }
  | { type: DynamicToolUIPart['type']; state: DynamicToolUIPart['state']; toolName: string }
)

const props = defineProps<ToolHeaderProps>()

const derivedName = computed(() =>
  props.type === 'dynamic-tool'
    ? props.toolName
    : props.type.split('-').slice(1).join('-'),
)
</script>

<template>
  <CollapsibleTrigger
    :class="cn('flex w-full items-center justify-between gap-3 px-3 py-2 text-[11px] hover:bg-hover cursor-pointer', props.class)"
    v-bind="$attrs"
  >
    <div class="flex items-center gap-2">
      <WrenchIcon class="size-3.5 text-muted" />
      <span class="font-medium text-surface">{{ props.title ?? derivedName }}</span>
      <ToolStatusBadge :state="props.state" />
    </div>
    <ChevronDownIcon
      class="size-3 text-muted transition-transform group-data-[state=open]:rotate-180"
    />
  </CollapsibleTrigger>
</template>
