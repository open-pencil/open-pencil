<script setup lang="ts">
import Prism from 'prismjs'
import 'prismjs/components/prism-jsx'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { selectionToJsx } from '@open-pencil/core'
import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()
const copied = ref(false)

const jsxCode = computed(() => {
  void store.state.sceneVersion
  const ids = [...store.state.selectedIds]
  if (ids.length === 0) return ''
  return selectionToJsx(ids, store.graph)
})

const highlightedLines = computed(() => {
  if (!jsxCode.value) return []
  const grammar = Prism.languages.jsx ?? Prism.languages.javascript
  return jsxCode.value.split('\n').map((line) => Prism.highlight(line, grammar, 'jsx'))
})

let copyTimeout: ReturnType<typeof setTimeout> | undefined

function copyCode() {
  navigator.clipboard.writeText(jsxCode.value)
  copied.value = true
  clearTimeout(copyTimeout)
  copyTimeout = setTimeout(() => (copied.value = false), 2000)
}

watch(jsxCode, () => {
  copied.value = false
})
</script>

<template>
  <div
    v-if="!jsxCode"
    data-test-id="code-panel-empty"
    class="flex flex-1 items-center justify-center px-4 text-center"
  >
    <span class="text-xs text-muted">Select a layer to see its JSX code</span>
  </div>

  <div v-else data-test-id="code-panel" class="flex min-h-0 flex-1 flex-col">
    <div
      data-test-id="code-panel-header"
      class="flex shrink-0 items-center justify-between border-b border-border px-3 py-1.5"
    >
      <span class="text-[11px] text-muted">JSX</span>
      <button
        data-test-id="code-panel-copy"
        class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
        @click="copyCode"
      >
        <icon-lucide-check v-if="copied" class="size-3 text-green-400" />
        <icon-lucide-copy v-else class="size-3" />
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>

    <ScrollAreaRoot class="min-h-0 flex-1">
      <ScrollAreaViewport class="size-full">
        <div class="p-3">
          <div v-for="(html, i) in highlightedLines" :key="i" class="flex text-xs leading-5">
            <span
              class="mr-3 shrink-0 select-none text-right text-muted/40"
              style="min-width: 1.5em"
              >{{ i + 1 }}</span
            >
            <pre
              class="m-0 min-w-0 flex-1 whitespace-pre-wrap break-words"
            ><code v-html="html" /></pre>
          </div>
        </div>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none select-none p-px">
        <ScrollAreaThumb class="relative flex-1 rounded-full bg-white/10" />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>
  </div>
</template>

<style>
.token.tag {
  color: #7dd3fc;
}
.token.attr-name {
  color: #c4b5fd;
}
.token.attr-value,
.token.string {
  color: #86efac;
}
.token.number {
  color: #fca5a5;
}
.token.punctuation {
  color: #888;
}
.token.boolean {
  color: #fca5a5;
}
.token.keyword {
  color: #c4b5fd;
}
</style>
