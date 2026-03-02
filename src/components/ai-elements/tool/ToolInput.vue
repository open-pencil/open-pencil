<script setup lang="ts">
// Adapted from ai-elements-vue — inline code display instead of CodeBlock dep
import type { DynamicToolUIPart, ToolUIPart } from 'ai'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '../utils'

type ToolPart = ToolUIPart | DynamicToolUIPart

interface Props {
  input: ToolPart['input']
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const formattedInput = computed(() => JSON.stringify(props.input, null, 2))
</script>

<template>
  <div :class="cn('space-y-1.5 overflow-hidden border-t border-border px-3 py-2', props.class)" v-bind="$attrs">
    <h4 class="text-[9px] font-medium uppercase tracking-wide text-muted">Parameters</h4>
    <pre class="overflow-x-auto rounded bg-input px-2 py-1.5 text-[10px] text-muted">{{ formattedInput }}</pre>
  </div>
</template>
