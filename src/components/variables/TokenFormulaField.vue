<script setup lang="ts">
import { useManualRefHistory } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, ref, shallowRef, useTemplateRef, watch, watchPostEffect } from 'vue'

import { useI18n } from '@open-pencil/vue'

import inputTheme from '@/theme/input/input'
import tokensPanelTheme from '@/theme/tokens-panel'

import {
  formulaFieldSelection,
  formulaFieldText,
  formulaSegments,
  selectFormulaField,
  type FormulaPill,
  type FormulaSegment,
  type FormulaSelection
} from './formula-field'

const model = defineModel<string>({ required: true })
const { resolve, state = 'idle' } = defineProps<{
  resolve: (source: string) => FormulaPill | undefined
  state?: 'idle' | 'bound' | 'invalid'
}>()
const emit = defineEmits<{
  change: []
  enter: []
  cancel: []
  selection: [range: FormulaSelection]
}>()
const field = useTemplateRef<HTMLDivElement>('field')
const ui = tv(tokensPanelTheme)()
const inputUI = tv(inputTheme)
const { variables } = useI18n()
const historyValue = shallowRef({
  source: model.value,
  range: { start: model.value.length, end: model.value.length }
})
const history = useManualRefHistory(historyValue, { capacity: 100 })
const composing = ref(false)
const revision = ref(0)
const pendingSelection = shallowRef<FormulaSelection | null>(null)
const source = ref(model.value)
const segments = computed(() => formulaSegments(source.value, resolve))

function remember() {
  if (!field.value) return
  const range = formulaFieldSelection(field.value)
  if (range) emit('selection', range)
}
function restoreSelection(range: FormulaSelection) {
  pendingSelection.value = range
}
watchPostEffect(() => {
  const range = pendingSelection.value
  if (!range || !field.value) return
  field.value.focus()
  selectFormulaField(field.value, range.start, range.end)
  pendingSelection.value = null
  emit('selection', range)
})
function update(value: string, range: FormulaSelection) {
  if (value !== historyValue.value.source) {
    historyValue.value = { source: value, range }
    history.commit()
  }
  source.value = value
  model.value = value
  // Native editing mutates the DOM. Replace that subtree before Vue renders the pills again.
  revision.value++
  restoreSelection(range)
  emit('selection', range)
}
function input() {
  if (composing.value || !field.value) return
  const source = formulaFieldText(field.value)
  const range = formulaFieldSelection(field.value) ?? { start: source.length, end: source.length }
  update(source, range)
}
function startComposition() {
  composing.value = true
}
function endComposition() {
  composing.value = false
  input()
}
function replace(text: string) {
  const root = field.value
  if (!root) return
  const range = formulaFieldSelection(root)
  if (!range) return
  const source = formulaFieldText(root)
  const caret = range.start + text.length
  update(source.slice(0, range.start) + text + source.slice(range.end), {
    start: caret,
    end: caret
  })
}
function clipboard(event: ClipboardEvent, cut = false) {
  if (!field.value) return
  const range = formulaFieldSelection(field.value)
  if (!range) return
  event.preventDefault()
  event.clipboardData?.setData('text/plain', model.value.slice(range.start, range.end))
  if (cut) replace('')
}
function blur(event: FocusEvent) {
  if (pendingSelection.value) return
  if (event.relatedTarget instanceof Node && field.value?.contains(event.relatedTarget)) return
  emit('change')
}
function remove({ start, end }: FormulaSegment) {
  update(source.value.slice(0, start) + source.value.slice(end), { start, end: start })
}
function editSelection(event: KeyboardEvent, root: HTMLElement, range: FormulaSelection) {
  if (event.code === 'Home' || event.code === 'End') {
    event.preventDefault()
    const end = event.code === 'Home' ? 0 : model.value.length
    const start = event.shiftKey ? range.start : end
    selectFormulaField(root, Math.min(start, end), Math.max(start, end))
    remember()
    return true
  }
  if (event.code === 'Backspace' || event.code === 'Delete') {
    if (range.start !== range.end) {
      event.preventDefault()
      replace('')
      return true
    }
    const segment = segments.value.find(
      ({ pill, start, end }) =>
        pill && (event.code === 'Backspace' ? range.start === end : range.start === start)
    )
    if (segment) {
      event.preventDefault()
      remove(segment)
      return true
    }
  }
  return false
}
function keydown(event: KeyboardEvent) {
  if (composing.value || event.isComposing) return
  if ((event.metaKey || event.ctrlKey) && (event.code === 'KeyZ' || event.code === 'KeyY')) {
    event.preventDefault()
    event.stopPropagation()
    if (event.shiftKey || event.code === 'KeyY') history.redo()
    else history.undo()
    update(historyValue.value.source, historyValue.value.range)
    return
  }
  const root = field.value
  const range = root ? formulaFieldSelection(root) : null
  if (root && range && editSelection(event, root, range)) return
  if (event.code === 'Enter' || event.code === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    if (event.code === 'Enter') emit('enter')
    else emit('cancel')
  }
}
watch(model, (value) => {
  if (value === source.value) return
  const range = field.value ? formulaFieldSelection(field.value) : null
  source.value = value
  historyValue.value = { source: value, range: range ?? { start: value.length, end: value.length } }
  history.commit()
  revision.value++
  if (range) restoreSelection(range)
})
defineExpose({
  focus: () => field.value?.focus(),
  blur: () => {
    const root = field.value
    root?.blur()
    if (root && formulaFieldSelection(root)) root.ownerDocument.getSelection()?.removeAllRanges()
  },
  setSelectionRange: (start: number, end: number) => {
    restoreSelection({ start, end })
  }
})
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="min-w-0">
    <div
      :key="revision"
      ref="field"
      v-bind="$attrs"
      role="textbox"
      aria-multiline="false"
      contenteditable="true"
      spellcheck="false"
      :class="[inputUI({ size: 'sm', state }), ui.formulaInput()]"
      @input="input"
      @blur="blur"
      @focus="remember"
      @mouseup="remember"
      @keyup="remember"
      @keydown="keydown"
      @paste.prevent="replace($event.clipboardData?.getData('text/plain') ?? '')"
      @copy="clipboard"
      @cut="clipboard($event, true)"
      @drop.prevent
      @compositionstart="startComposition"
      @compositionend="endComposition"
    >
      <template v-for="segment in segments" :key="segment.start">
        <span
          v-if="segment.pill"
          contenteditable="false"
          :data-reference="segment.source"
          :class="ui.formulaPill()"
        >
          <span :class="ui.formulaPillLabel()">{{ segment.pill.label }}</span>
          <span :class="ui.formulaPillValue()">{{ segment.pill.displayValue }}</span>
          <button
            type="button"
            :class="ui.formulaPillRemove()"
            :aria-label="variables.removeReference({ name: segment.pill.label })"
            @pointerdown.prevent
            @click.stop="remove(segment)"
            @keydown.enter.stop.prevent="remove(segment)"
            @keydown.space.stop.prevent="remove(segment)"
          >
            <icon-lucide-x class="size-3" />
          </button>
        </span>
        <template v-else>{{ segment.source }}</template>
      </template>
    </div>
  </div>
</template>
