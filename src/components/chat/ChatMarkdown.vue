<script setup lang="ts">
import { computed } from 'vue'

import { referenceComponents } from '@/app/ai/chat/references/link'
import { markdownRenderKey, type MarkdownSurface } from '@/app/shell/markdown/state'
import ChatReferenceLink from '@/components/chat/reference/ChatReferenceLink.vue'
import MarkdownContent from '@/components/markdown/MarkdownContent.vue'

const {
  content,
  mode = 'static',
  surface = 'message'
} = defineProps<{
  content: string
  mode?: 'static' | 'streaming'
  surface?: MarkdownSurface
}>()

const renderKey = computed(() => markdownRenderKey({ mode, surface }))
// References to layers, pages, and skills render as chips; other links stay links.
const rendered = computed(() => referenceComponents(content))
const components = { 'chat-reference': ChatReferenceLink }
</script>

<template>
  <MarkdownContent
    :key="renderKey"
    data-slot="chat-markdown"
    :content="rendered"
    :components="components"
    :mode="mode"
    density="compact"
    highlight-code
  />
</template>
