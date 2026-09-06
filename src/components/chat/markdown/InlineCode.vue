<script setup lang="ts">
import type { MarkdownComponentProps } from 'vue-stream-markdown'

const { node: _node } = defineProps<MarkdownComponentProps>()
</script>

<template>
  <code
    data-stream-markdown="inline-code"
    class="rounded bg-hover px-1 py-px font-mono text-[11px] leading-4 text-surface break-words whitespace-normal"
    dir="ltr"
  >
    <slot />
  </code>
</template>
