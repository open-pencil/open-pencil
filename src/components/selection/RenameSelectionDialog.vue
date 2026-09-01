<script setup lang="ts">
import { computed, nextTick, ref, watch, useTemplateRef } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'

const store = useEditorStore()
const { rename, common } = useI18n()
const match = ref('')
const replacement = ref('')
const startNumber = ref(1)
const matchInput = useTemplateRef<HTMLInputElement>('match-input')
const replacementInput = useTemplateRef<HTMLInputElement>('replacement-input')
const selectedNodes = computed(() => store.selectedNodes.value)
const options = computed(() => ({
  match: match.value,
  replacement: replacement.value,
  startNumber: startNumber.value
}))
const preview = computed(() => store.previewRenameSelected(options.value))
const hasRenameInput = computed(() => match.value.length > 0 || replacement.value.length > 0)
const canSubmit = computed(() => hasRenameInput.value && preview.value.error === null)
const hasAscendingNumber = computed(() => /\$n+/.test(replacement.value))
const hasDescendingNumber = computed(() => /\$N+/.test(replacement.value))
const showStartNumber = computed(() => hasAscendingNumber.value || hasDescendingNumber.value)
const title = computed(() => rename.value.layers({ count: String(selectedNodes.value.length) }))

watch(
  () => store.state.renameSelectionOpen,
  (open) => {
    if (!open) return
    match.value = ''
    replacement.value = ''
    startNumber.value = 1
    void nextTick(() => matchInput.value?.focus())
  }
)

async function insertToken(token: '$&' | '$n' | '$N') {
  const input = replacementInput.value
  const start = input?.selectionStart ?? replacement.value.length
  const end = input?.selectionEnd ?? start
  replacement.value = replacement.value.slice(0, start) + token + replacement.value.slice(end)
  await nextTick()
  input?.focus()
  input?.setSelectionRange(start + token.length, start + token.length)
}

function submit() {
  if (!canSubmit.value) return
  store.renameSelected(options.value)
  store.state.renameSelectionOpen = false
}
</script>

<template>
  <AppDialogRoot v-model:open="store.state.renameSelectionOpen" size="sm">
    <AppDialogHeader :heading="title" :close-label="common.close" />
    <AppDialogBody>
      <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <div class="min-w-0">
          <div class="mb-1.5 text-xs text-muted">{{ rename.preview }}</div>
          <ul :aria-label="rename.preview" class="max-h-36 space-y-1 overflow-auto text-xs">
            <li v-for="node in selectedNodes" :key="node.id" class="truncate text-surface">
              {{ hasRenameInput ? (preview.names.get(node.id) ?? node.name) : node.name }}
            </li>
          </ul>
        </div>
        <div class="flex min-w-0 flex-col gap-2">
          <label class="flex flex-col gap-1 text-xs text-muted">
            {{ rename.match }}
            <input
              ref="match-input"
              v-model="match"
              class="h-8 rounded border border-border bg-input px-2 text-sm text-surface outline-none focus:border-panel-focus"
              @keydown.enter.prevent="submit"
            />
          </label>
          <label class="flex flex-col gap-1 text-xs text-muted">
            {{ rename.to }}
            <input
              ref="replacement-input"
              v-model="replacement"
              class="h-8 rounded border border-border bg-input px-2 text-sm text-surface outline-none focus:border-panel-focus"
              @keydown.enter.prevent="submit"
            />
          </label>
          <div class="flex flex-wrap gap-1">
            <button
              type="button"
              class="cursor-pointer rounded border border-border px-1.5 py-1 text-[11px] text-surface hover:bg-hover"
              @click="insertToken('$&')"
            >
              {{ rename.currentName }}
            </button>
            <button
              type="button"
              class="cursor-pointer rounded border border-border px-1.5 py-1 text-[11px] text-surface hover:bg-hover"
              @click="insertToken('$n')"
            >
              {{ rename.numberAscending }}
            </button>
            <button
              type="button"
              class="cursor-pointer rounded border border-border px-1.5 py-1 text-[11px] text-surface hover:bg-hover"
              @click="insertToken('$N')"
            >
              {{ rename.numberDescending }}
            </button>
          </div>
          <label v-if="showStartNumber" class="flex items-center gap-2 text-xs text-muted">
            <span class="flex-1">
              {{ hasDescendingNumber ? rename.stopDescendingAt : rename.startAscendingFrom }}
            </span>
            <input
              v-model.number="startNumber"
              type="number"
              class="h-8 w-16 rounded border border-border bg-input px-2 text-sm text-surface outline-none focus:border-panel-focus"
              @keydown.enter.prevent="submit"
            />
          </label>
          <p v-if="preview.error" class="text-xs text-danger" role="alert">
            {{ rename.invalidPattern }}
          </p>
        </div>
      </div>
    </AppDialogBody>
    <AppDialogFooter>
      <button
        type="button"
        class="h-8 cursor-pointer rounded px-3 text-xs font-medium text-surface hover:bg-hover"
        @click="store.state.renameSelectionOpen = false"
      >
        {{ common.cancel }}
      </button>
      <button
        type="button"
        :disabled="!canSubmit"
        class="h-8 cursor-pointer rounded bg-accent px-3 text-xs font-medium text-white disabled:cursor-default disabled:opacity-40"
        @click="submit"
      >
        {{ rename.title }}
      </button>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
