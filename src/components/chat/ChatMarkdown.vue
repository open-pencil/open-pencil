<script setup lang="ts">
import { computed } from 'vue'

import { referenceComponents } from '@/app/ai/chat/references/link'
import ChatReferenceLink from '@/components/chat/reference/ChatReferenceLink.vue'
import MarkdownContent from '@/components/markdown/MarkdownContent.vue'

const { content, mode = 'static' } = defineProps<{
  content: string
  mode?: 'static' | 'streaming'
}>()

// References to layers, pages, and skills render as chips; other links stay links.
const rendered = computed(() => referenceComponents(content))
const components = { 'chat-reference': ChatReferenceLink }
</script>

<template>
  <!-- One renderer for the text's whole life: a new one when the reply settles would replay its
       fade-in over text already read. -->
  <MarkdownContent
    data-slot="chat-markdown"
    :content="rendered"
    :components="components"
    :mode="mode"
    density="compact"
    highlight-code
  />
</template>
