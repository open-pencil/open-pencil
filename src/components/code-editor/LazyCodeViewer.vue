<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'

import type { CodeViewerLanguage } from '@/components/code-editor/CodeViewer.vue'
import { codeViewerHeight, loadCodeViewer } from '@/components/code-editor/lazy'

// CodeMirror loads with the first viewer shown, not with the screen that may show one.
const CodeViewer = defineAsyncComponent(loadCodeViewer)

const { code, language, label, original } = defineProps<{
  code: string
  language: CodeViewerLanguage
  label: string
  original?: string
}>()

// A diff collapses unchanged lines, so only plain code has a height known in advance.
const minHeight = computed(() =>
  original === undefined ? `${codeViewerHeight(code)}px` : undefined
)
</script>

<template>
  <div :style="{ minHeight }">
    <CodeViewer :code="code" :language="language" :label="label" :original="original" />
  </div>
</template>
