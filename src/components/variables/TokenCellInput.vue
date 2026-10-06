<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { onMounted, ref, useTemplateRef } from 'vue'

import tokensPanelTheme from '@/theme/tokens-panel'

/**
 * Edits one cell of the token list in place. Enter or leaving the field commits, Escape cancels,
 * and keys stay in the field instead of moving the list's highlight.
 */
const { value, label } = defineProps<{ value: string; label: string }>()
const emit = defineEmits<{ commit: [text: string]; cancel: [] }>()

const ui = tv(tokensPanelTheme)()
const draft = ref(value)
const input = useTemplateRef('input')
let done = false

onMounted(() => {
  input.value?.focus()
  input.value?.select()
})

function finish(commit: boolean) {
  if (done) return
  done = true
  if (commit) emit('commit', draft.value)
  else emit('cancel')
}

function onKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.code === 'Enter' || event.code === 'NumpadEnter') finish(true)
  else if (event.code === 'Escape') finish(false)
}
</script>

<template>
  <input
    ref="input"
    v-model="draft"
    :aria-label="label"
    :class="ui.cellInput()"
    data-test-id="variables-cell-input"
    @keydown="onKeydown"
    @click.stop
    @dblclick.stop
    @pointerdown.stop
    @blur="finish(true)"
  />
</template>
