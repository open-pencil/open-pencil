<script setup lang="ts">
import { computed } from 'vue'

import { markdownRenderKey, type MarkdownSurface } from '@/app/shell/markdown/state'
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
</script>

<template>
  <MarkdownContent
    :key="renderKey"
    data-slot="chat-markdown"
    :content="content"
    :mode="mode"
    density="compact"
    highlight-code
  />
</template>
