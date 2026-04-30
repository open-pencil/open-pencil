<script setup lang="ts">
import Prism from 'prismjs'
import 'prismjs/components/prism-jsx'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'

import { JSX_REFERENCE, selectionToJSX } from '@open-pencil/core/design-jsx'
import { useI18n, useSceneComputed } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'

import type { JSXFormat } from '@open-pencil/core/design-jsx'

const store = useEditorStore()
const { copy, copied } = useClipboard({ copiedDuring: 2000 })
const { dialogs } = useI18n()
const jsxFormat = ref<JSXFormat>('openpencil')

function toggleFormat() {
  jsxFormat.value = jsxFormat.value === 'openpencil' ? 'tailwind' : 'openpencil'
}

const jsxCode = useSceneComputed(() => {
  void store.state.sceneVersion
  const ids = [...store.state.selectedIds]
  if (ids.length === 0) return ''
  return selectionToJSX(ids, store.graph, jsxFormat.value)
})

const highlightedLines = computed(() => {
  if (!jsxCode.value) return []
  const grammar = Prism.languages.jsx ?? Prism.languages.javascript
  return jsxCode.value.split('\n').map((line) => Prism.highlight(line, grammar, 'jsx'))
})

const { copy: copyRef, copied: copiedRef } = useClipboard({ copiedDuring: 2000 })

function copyCode() {
  copy(jsxCode.value)
}

function copyReference() {
  copyRef(JSX_REFERENCE)
}
</script>

<template>
  <div
    v-if="!jsxCode"
    data-test-id="code-panel-empty"
    class="flex flex-1 items-center justify-center px-4 text-center"
  >
    <span class="text-xs text-muted">{{ dialogs.selectLayerForJSX }}</span>
  </div>

  <div v-else data-test-id="code-panel" class="flex min-h-0 flex-1 flex-col">
    <div
      data-test-id="code-panel-header"
      class="flex shrink-0 items-center justify-between border-b border-border px-3 py-1.5"
    >
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] text-muted">JSX</span>
        <button
          data-test-id="code-panel-format-toggle"
          class="rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          @click="toggleFormat"
        >
          {{ jsxFormat === 'openpencil' ? 'OpenPencil' : 'Tailwind' }}
        </button>
      </div>
      <div class="flex items-center gap-1">
        <button
          data-test-id="code-panel-copy-ref"
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          title="Copy JSX prop reference to clipboard"
          @click="copyReference"
        >
          <icon-lucide-check v-if="copiedRef" class="size-3 text-[var(--color-success)]" />
          <icon-lucide-book-open v-else class="size-3" />
        </button>
        <button
          data-test-id="code-panel-copy"
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          @click="copyCode"
        >
          <icon-lucide-check v-if="copied" class="size-3 text-[var(--color-success)]" />
          <icon-lucide-copy v-else class="size-3" />
          {{ copied ? dialogs.copied : dialogs.copy }}
        </button>
      </div>
    </div>

    <ScrollAreaRoot class="min-h-0 flex-1">
      <ScrollAreaViewport class="size-full">
        <div class="p-3">
          <div v-for="(html, i) in highlightedLines" :key="i" class="flex text-xs leading-5">
            <span
              class="mr-3 shrink-0 text-right text-muted/40 select-none"
              style="min-width: 1.5em"
              >{{ i + 1 }}</span
            >
            <pre
              class="m-0 min-w-0 flex-1 break-words whitespace-pre-wrap"
            ><code v-html="html" /></pre>
          </div>
        </div>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
        <ScrollAreaThumb class="relative flex-1 rounded-full bg-white/10" />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>
  </div>
</template>

<style scoped>
.token.tag {
  color: var(--color-code-tag);
}
.token.attr-name {
  color: var(--color-code-attribute);
}
.token.attr-value,
.token.string {
  color: var(--color-code-string);
}
.token.number {
  color: var(--color-code-number);
}
.token.punctuation {
  color: var(--color-code-punctuation);
}
.token.boolean {
  color: var(--color-code-number);
}
.token.keyword {
  color: var(--color-code-attribute);
}
</style>
