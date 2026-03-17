<script setup lang="ts">
import Prism from 'prismjs'
import 'prismjs/components/prism-jsx'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'

import { selectionToJSX, JSX_REFERENCE } from '@open-pencil/core'
import { useEditorStore } from '@/stores/editor'

import type { JSXFormat } from '@open-pencil/core'

const store = useEditorStore()
const copied = ref(false)
const jsxFormat = ref<JSXFormat>('openpencil')
const editing = ref(false)
const editorCode = ref('')
const editorError = ref('')
const applying = ref(false)
const replaceIds = ref<string[]>([])
const textareaRef = ref<HTMLTextAreaElement>()
const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
const refCopied = ref(false)
let refCopyTimeout: ReturnType<typeof setTimeout> | undefined

function copyReference() {
  navigator.clipboard.writeText(JSX_REFERENCE)
  refCopied.value = true
  clearTimeout(refCopyTimeout)
  refCopyTimeout = setTimeout(() => (refCopied.value = false), 2000)
}

function toggleFormat() {
  jsxFormat.value = jsxFormat.value === 'openpencil' ? 'tailwind' : 'openpencil'
}

const jsxCode = computed(() => {
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

const editorHighlightedLines = computed(() => {
  if (!editorCode.value) return []
  const grammar = Prism.languages.jsx ?? Prism.languages.javascript
  return editorCode.value.split('\n').map((line) => Prism.highlight(line, grammar, 'jsx'))
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

const canEdit = computed(() => jsxFormat.value === 'openpencil')

function enterEditMode() {
  jsxFormat.value = 'openpencil'
  editorCode.value = jsxCode.value
  replaceIds.value = [...store.state.selectedIds]
  editing.value = true
  editorError.value = ''
  void nextTick(() => textareaRef.value?.focus())
}

function exitEditMode() {
  editing.value = false
  editorCode.value = ''
  editorError.value = ''
  replaceIds.value = []
}

async function applyJSX() {
  const code = editorCode.value.trim()
  if (!code) return

  applying.value = true
  editorError.value = ''

  try {
    await store.renderJSXWithUndo(code, replaceIds.value.length > 0 ? replaceIds.value : undefined)
    editorCode.value = ''
    replaceIds.value = []
    editing.value = false
  } catch (e) {
    editorError.value = e instanceof Error ? e.message : String(e)
  } finally {
    applying.value = false
  }
}

function handleEditorKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const textarea = textareaRef.value
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    editorCode.value = editorCode.value.substring(0, start) + '  ' + editorCode.value.substring(end)
    void nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2
    })
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    void applyJSX()
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    exitEditMode()
  }
}
</script>

<template>
  <!-- Editor mode -->
  <div v-if="editing" data-test-id="code-panel-editor" class="flex min-h-0 flex-1 flex-col">
    <div class="flex shrink-0 items-center justify-between border-b border-border px-3 py-1.5">
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] text-muted">JSX Editor</span>
        <button
          data-test-id="code-panel-copy-ref"
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          title="Copy JSX Reference"
          @click="copyReference"
        >
          <icon-lucide-check v-if="refCopied" class="size-3 text-green-400" />
          <icon-lucide-book-open v-else class="size-3" />
        </button>
      </div>
      <div class="flex items-center gap-1">
        <button
          data-test-id="code-panel-apply"
          class="flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[11px] text-white hover:bg-blue-500 disabled:opacity-50"
          :disabled="!editorCode.trim() || applying"
          @click="applyJSX"
        >
          <icon-lucide-play class="size-3" />
          {{ applying ? 'Applying…' : 'Apply' }}
        </button>
        <button
          data-test-id="code-panel-cancel"
          class="rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          @click="exitEditMode"
        >
          Cancel
        </button>
      </div>
    </div>

    <div v-if="editorError" class="border-b border-red-500/30 bg-red-500/10 px-3 py-2">
      <p class="text-[11px] text-red-400">{{ editorError }}</p>
    </div>

    <div class="relative min-h-0 flex-1">
      <ScrollAreaRoot class="absolute inset-0">
        <ScrollAreaViewport class="size-full">
          <div class="relative p-3">
            <!-- Syntax-highlighted underlay -->
            <div class="pointer-events-none" aria-hidden="true">
              <div
                v-for="(html, i) in editorHighlightedLines"
                :key="i"
                class="flex text-xs leading-5"
              >
                <span
                  class="mr-3 shrink-0 text-right text-muted/40 select-none"
                  style="min-width: 1.5em"
                  >{{ i + 1 }}</span
                >
                <pre
                  class="m-0 min-w-0 flex-1 break-words whitespace-pre-wrap"
                ><code v-html="html" /></pre>
              </div>
              <div v-if="!editorCode" class="flex text-xs leading-5">
                <span
                  class="mr-3 shrink-0 text-right text-muted/40 select-none"
                  style="min-width: 1.5em"
                  >1</span
                >
                <span class="text-muted/40">Paste or write JSX here…</span>
              </div>
            </div>

            <!-- Invisible textarea overlay -->
            <textarea
              ref="textareaRef"
              v-model="editorCode"
              data-test-id="code-panel-textarea"
              class="absolute inset-0 m-3 resize-none border-0 bg-transparent font-mono text-xs leading-5 text-transparent caret-white outline-none"
              style="padding-left: calc(1.5em + 0.75rem)"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              @keydown="handleEditorKeydown"
            />
          </div>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
          <ScrollAreaThumb class="relative flex-1 rounded-full bg-white/10" />
        </ScrollAreaScrollbar>
      </ScrollAreaRoot>
    </div>

    <div class="shrink-0 border-t border-border px-3 py-1.5">
      <span class="text-[10px] text-muted/60">
        {{ isMac ? '⌘' : 'Ctrl' }}+Enter to apply · Esc to cancel
      </span>
    </div>
  </div>

  <!-- Empty state -->
  <div
    v-else-if="!jsxCode"
    data-test-id="code-panel-empty"
    class="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
  >
    <span class="text-xs text-muted">Select a layer to see its JSX code</span>
    <button
      data-test-id="code-panel-new"
      class="flex items-center gap-1 rounded border border-border px-2.5 py-1 text-[11px] text-muted hover:bg-hover hover:text-surface"
      @click="enterEditMode"
    >
      <icon-lucide-plus class="size-3" />
      Write JSX
    </button>
  </div>

  <!-- Read-only view -->
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
          v-if="canEdit"
          data-test-id="code-panel-edit"
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          title="Edit JSX"
          @click="enterEditMode"
        >
          <icon-lucide-pencil class="size-3" />
        </button>
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
