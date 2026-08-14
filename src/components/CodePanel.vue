<script setup lang="ts">
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { useClipboard } from '@vueuse/core'
import { computed, defineAsyncComponent, ref, watch } from 'vue'

import { JSX_REFERENCE, selectionToJSX } from '@open-pencil/core/design-jsx'
import { useI18n, useSceneComputed } from '@open-pencil/vue'

import { applyDesignJSX } from '@/app/code/apply'
import { highlightJSX } from '@/app/code/highlight'
import { useEditorStore } from '@/app/editor/active-store'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import AppTextButton from '@/components/ui/AppTextButton.vue'
import Tip from '@/components/ui/Tip.vue'

import type { JSXFormat } from '@open-pencil/core/design-jsx'

const CodeEditor = defineAsyncComponent(() => import('@/components/code-editor/CodeEditor.vue'))

const { active = true } = defineProps<{ active?: boolean }>()
const store = useEditorStore()
const { copy, copied } = useClipboard({ copiedDuring: 2000 })
const { dialogs } = useI18n()
const jsxFormat = ref<JSXFormat>('openpencil')
const showImporter = ref(false)
const importHTML = ref('')
const importCSS = ref('')
const importError = ref('')
const importing = ref(false)
const editing = ref(false)
const draft = ref('')
const draftDirty = ref(false)
const applying = ref(false)
const applyError = ref('')

function toggleFormat() {
  jsxFormat.value = jsxFormat.value === 'openpencil' ? 'tailwind' : 'openpencil'
}

const jsxCode = useSceneComputed(() => {
  if (!active) return ''
  void store.state.sceneVersion
  const ids = [...store.state.selectedIds]
  if (ids.length === 0) return ''
  return selectionToJSX(ids, store.graph, jsxFormat.value)
})

const highlightedLines = computed(() => {
  if (!jsxCode.value) return []
  return jsxCode.value.split('\n').map(highlightJSX)
})

watch(jsxCode, (value) => {
  if (!draftDirty.value) draft.value = value
})

function startEditing() {
  draft.value = jsxCode.value || '<Frame name="New frame" w={320} h={240} fill="#ffffff" />'
  draftDirty.value = false
  applyError.value = ''
  editing.value = true
}

function updateDraft(value: string) {
  draft.value = value
  draftDirty.value = value !== jsxCode.value
  applyError.value = ''
}

async function applyDraft() {
  if (applying.value || draft.value.trim().length === 0) return
  applying.value = true
  applyError.value = ''
  const result = await applyDesignJSX(store, draft.value)
  applying.value = false
  if (!result.ok) {
    applyError.value = result.error
    return
  }
  draftDirty.value = false
}

const { copy: copyRef, copied: copiedRef } = useClipboard({ copiedDuring: 2000 })

const canImport = computed(() => importHTML.value.trim().length > 0)

watch([importHTML, importCSS], () => {
  importError.value = ''
})

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return dialogs.value.importFailed
}

function toggleImporter() {
  showImporter.value = !showImporter.value
}

async function pasteImportHTML() {
  try {
    importError.value = ''
    importHTML.value = await navigator.clipboard.readText()
  } catch (e) {
    importError.value = errorMessage(e)
  }
}

async function importCode() {
  if (!canImport.value || importing.value) return
  try {
    importing.value = true
    importError.value = ''
    await store.importDOMText(importHTML.value, {
      cssText: importCSS.value.trim() || undefined
    })
  } catch (e) {
    importError.value = errorMessage(e)
  } finally {
    importing.value = false
  }
}

function copyCode() {
  copy(jsxCode.value)
}

function copyReference() {
  copyRef(JSX_REFERENCE)
}
</script>

<template>
  <div data-test-id="code-panel-root" class="flex min-h-0 flex-1 flex-col">
    <div
      data-test-id="code-panel-header"
      class="flex shrink-0 items-center justify-between border-b border-border px-3 py-1.5"
    >
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] text-muted">JSX</span>
        <AppTextButton
          data-test-id="code-panel-format-toggle"
          :ui="{ base: 'rounded px-1.5 py-0.5 text-[11px] hover:bg-hover' }"
          @click="toggleFormat"
        >
          {{ jsxFormat === 'openpencil' ? 'OpenPencil' : 'Tailwind' }}
        </AppTextButton>
      </div>
      <div class="flex items-center gap-1">
        <AppTextButton
          data-test-id="code-panel-import-toggle"
          :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-hover' }"
          @click="toggleImporter"
        >
          <icon-lucide-file-input class="size-3" />
          {{ dialogs.importLabel }}
        </AppTextButton>
        <Tip :label="dialogs.copyJSXReference">
          <AppTextButton
            data-test-id="code-panel-copy-ref"
            :ui="{
              base: 'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-hover'
            }"
            @click="copyReference"
          >
            <icon-lucide-check v-if="copiedRef" class="size-3 text-[var(--color-success)]" />
            <icon-lucide-book-open v-else class="size-3" />
          </AppTextButton>
        </Tip>
        <AppTextButton
          data-test-id="code-panel-edit"
          :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-hover' }"
          @click="startEditing"
        >
          <icon-lucide-pencil class="size-3" />
          {{ dialogs.editJSX }}
        </AppTextButton>
        <AppTextButton
          data-test-id="code-panel-copy"
          :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-hover' }"
          @click="copyCode"
        >
          <icon-lucide-check v-if="copied" class="size-3 text-[var(--color-success)]" />
          <icon-lucide-copy v-else class="size-3" />
          {{ copied ? dialogs.copied : dialogs.copy }}
        </AppTextButton>
      </div>
    </div>

    <div
      v-if="showImporter || !jsxCode"
      data-test-id="code-panel-importer"
      class="shrink-0 border-b border-border p-3"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-medium text-surface">{{ dialogs.importHTMLCSS }}</div>
          <div class="text-[11px] text-muted">
            {{ dialogs.importHTMLCSSDescription }}
          </div>
        </div>
        <AppTextButton
          data-test-id="code-panel-paste-import"
          :ui="{ base: 'rounded px-1.5 py-0.5 text-[11px] hover:bg-hover' }"
          @click="pasteImportHTML"
        >
          {{ dialogs.paste }}
        </AppTextButton>
      </div>
      <textarea
        v-model="importHTML"
        data-test-id="code-panel-import-html"
        class="mb-2 h-28 w-full resize-none rounded border border-border bg-panel px-2 py-1.5 font-mono text-xs text-surface outline-none placeholder:text-muted/50 focus:border-accent"
        placeholder='<div class="card">Hello</div>'
        spellcheck="false"
      />
      <textarea
        v-model="importCSS"
        data-test-id="code-panel-import-css"
        class="mb-2 h-20 w-full resize-none rounded border border-border bg-panel px-2 py-1.5 font-mono text-xs text-surface outline-none placeholder:text-muted/50 focus:border-accent"
        placeholder=".card { width: 240px; padding: 16px; border-radius: 12px; background: white; }"
        spellcheck="false"
      />
      <div
        v-if="importError"
        data-test-id="code-panel-import-error"
        class="mb-2 rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200"
      >
        {{ importError }}
      </div>
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] text-muted">{{ dialogs.importReplacesDocument }}</span>
        <AppTextButton
          data-test-id="code-panel-import"
          :ui="{
            base: [
              'rounded px-2 py-1 text-[11px]',
              canImport && !importing
                ? 'bg-accent text-black hover:bg-accent/90'
                : 'cursor-not-allowed opacity-50'
            ].join(' ')
          }"
          @click="importCode"
        >
          {{ importing ? dialogs.importing : dialogs.importToCanvas }}
        </AppTextButton>
      </div>
    </div>

    <div v-if="editing" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CodeEditor :model-value="draft" @update:model-value="updateDraft" @apply="applyDraft" />
      <div
        v-if="applyError"
        data-test-id="code-panel-jsx-error"
        class="shrink-0 border-t border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200"
      >
        {{ applyError }}
      </div>
      <div class="flex shrink-0 items-center justify-between border-t border-border px-3 py-2">
        <span class="text-[11px] text-muted">{{
          draftDirty ? dialogs.jsxUnsavedChanges : dialogs.jsxUpToDate
        }}</span>
        <AppTextButton
          data-test-id="code-panel-apply-jsx"
          :ui="{
            base: [
              'rounded px-2 py-1 text-[11px]',
              !applying && draft.trim()
                ? 'bg-accent text-black hover:bg-accent/90'
                : 'cursor-not-allowed opacity-50'
            ].join(' ')
          }"
          @click="applyDraft"
        >
          {{
            applying
              ? dialogs.applyingJSX
              : store.state.selectedIds.size > 0
                ? dialogs.applyJSX
                : dialogs.insertJSX
          }}
        </AppTextButton>
      </div>
    </div>

    <AppPlaceholder
      v-else-if="!jsxCode"
      data-test-id="code-panel-empty"
      :label="dialogs.selectLayerForJSX"
    >
      <template #icon>
        <icon-lucide-code-2 class="size-5" />
      </template>
    </AppPlaceholder>

    <ScrollAreaRoot v-else data-test-id="code-panel" class="min-h-0 flex-1">
      <ScrollAreaViewport class="code-highlight size-full">
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
