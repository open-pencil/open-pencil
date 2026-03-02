<script setup lang="ts">
// Adapted from ai-elements-vue — reka-ui + vue-stream-markdown
import type { HTMLAttributes } from 'vue'
import { CollapsibleContent } from 'reka-ui'
import { Markdown } from 'vue-stream-markdown'
import 'vue-stream-markdown/index.css'
import { computed, useSlots } from 'vue'
import { cn } from '../utils'

interface Props {
  class?: HTMLAttributes['class']
  content?: string
}

const props = defineProps<Props>()
const slots = useSlots()

const slotContent = computed<string | undefined>(() => {
  const nodes = slots.default?.()
  if (!Array.isArray(nodes)) return undefined
  let text = ''
  for (const node of nodes) {
    if (typeof node.children === 'string') text += node.children
  }
  return text || undefined
})

const md = computed(() => (slotContent.value ?? props.content ?? '') as string)
</script>

<template>
  <CollapsibleContent
    :class="cn(
      'overflow-hidden text-[11px] leading-relaxed text-muted italic',
      'data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
      props.class,
    )"
  >
    <div class="border-t border-border px-3 py-2">
      <Markdown :content="md" :theme="['github-dark', 'github-dark']" class="chat-markdown" />
    </div>
  </CollapsibleContent>
</template>
