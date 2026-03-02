<script setup lang="ts">
// Adapted from ai-elements-vue — inline code display instead of CodeBlock dep
import type { DynamicToolUIPart, ToolUIPart } from 'ai'
import type { HTMLAttributes } from 'vue'
import { computed, isVNode } from 'vue'
import { cn } from '../utils'

export type ToolPart = ToolUIPart | DynamicToolUIPart

interface Props {
  output: ToolPart['output']
  errorText: ToolPart['errorText']
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const showOutput = computed(() => props.output !== undefined || props.errorText)
const isObjectOutput = computed(() => typeof props.output === 'object' && !isVNode(props.output))
const formattedOutput = computed(() =>
  isObjectOutput.value ? JSON.stringify(props.output, null, 2) : String(props.output ?? ''),
)
</script>

<template>
  <div
    v-if="showOutput"
    :class="cn('space-y-1.5 border-t border-border px-3 py-2', props.class)"
    v-bind="$attrs"
  >
    <h4 class="text-[9px] font-medium uppercase tracking-wide text-muted">
      {{ props.errorText ? 'Error' : 'Result' }}
    </h4>
    <pre
      :class="cn(
        'overflow-x-auto rounded px-2 py-1.5 text-[10px]',
        props.errorText ? 'bg-red-500/10 text-red-400' : 'bg-input text-muted',
      )"
    >{{ props.errorText ?? formattedOutput }}</pre>
  </div>
</template>
