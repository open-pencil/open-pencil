<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, ref, useId, useTemplateRef, watch } from 'vue'

import { loadTokenValidator } from '@open-pencil/dom-css/export'
import type { Variable } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import {
  tokenValueText,
  type AliasCandidate,
  type TokenFormulaActions
} from '@/app/editor/tokens/model'
import {
  parseTokenEditorText,
  tokenEditorText,
  type TokenValueEdit
} from '@/app/editor/tokens/value-editor'
import { VariablePicker } from '@/components/ui/binding'
import tokensPanelTheme from '@/theme/tokens-panel'

import type { FormulaSelection } from './formula-field'
import type TokenFormulaField from './TokenFormulaField.vue'

const { variable, modeId, label, candidates, formula } = defineProps<{
  variable: Variable
  modeId: string
  label: string
  candidates: AliasCandidate[]
  formula: TokenFormulaActions
}>()
const emit = defineEmits<{ apply: [edit: TokenValueEdit]; done: [] }>()
const { variables } = useI18n()
const ui = tv(tokensPanelTheme)()
const fieldId = useId()
const draft = ref('')
const commitError = ref('')
const field = useTemplateRef<InstanceType<typeof TokenFormulaField>>('field')
const selection = ref<FormulaSelection | null>(null)
const insertionCaret = ref<number | null>(null)
const submitted = ref<string | null>(null)
const validator = computedAsync(loadTokenValidator, null)
const saved = computed(() => tokenEditorText(variable, modeId, formula))
watch(
  [() => variable.id, () => modeId],
  () => {
    draft.value = saved.value
    selection.value = null
    insertionCaret.value = null
    submitted.value = null
  },
  { immediate: true }
)
watch(saved, (value) => {
  // Acknowledging our own commit preserves the authored spelling and picker selection.
  if (value !== submitted.value) {
    draft.value = value
    selection.value = null
  }
  submitted.value = null
})
watch(draft, () => {
  commitError.value = ''
})
const alias = computed(() => {
  const value = variable.valuesByMode[modeId]
  return typeof value === 'object' && 'aliasId' in value ? value.aliasId : undefined
})
const pickerItems = computed(() =>
  candidates.map((candidate) => {
    try {
      const { resolved } = formula.parse(modeId, formula.reference(candidate.id))
      return { ...candidate, text: tokenValueText(variable, resolved) }
    } catch {
      return { ...candidate, text: '—' }
    }
  })
)
const candidatesById = computed(() => new Map(pickerItems.value.map((item) => [item.id, item])))
function resolveReference(source: string) {
  try {
    const { value } = formula.parse(modeId, source)
    if (typeof value !== 'object' || !('aliasId' in value)) return
    const candidate = candidatesById.value.get(value.aliasId)
    if (candidate) return { label: candidate.name, displayValue: candidate.text }
  } catch {
    // Incomplete or invalid references remain editable source text.
    return undefined
  }
}
function parse() {
  return parseTokenEditorText(
    variable,
    modeId,
    draft.value,
    formula,
    (text) =>
      validator.value?.declaration('value', text) === true &&
      ['width', 'opacity', 'z-index'].some((property) => CSS.supports(property, text))
  )
}
const preview = computed(() => {
  try {
    return { result: parse(), error: '' }
  } catch (error) {
    return { result: undefined, error: error instanceof Error ? error.message : String(error) }
  }
})
const error = computed(() => commitError.value || preview.value.error)
const fieldState = computed(() => {
  if (error.value) return 'invalid'
  return alias.value ? 'bound' : 'idle'
})
const resultText = computed(
  () =>
    error.value ||
    `${variables.value.formulaResult}: ${tokenValueText(variable, preview.value.result?.resolved)}`
)
const resultClass = computed(() => (error.value ? ui.error() : ui.hint()))
function apply() {
  if (draft.value === saved.value) return true
  try {
    const edit = parse()
    submitted.value = edit.expression?.css ?? formula.format(edit.value)
    emit('apply', edit)
    return true
  } catch (error) {
    commitError.value = error instanceof Error ? error.message : String(error)
    return false
  }
}
function done() {
  if (!apply()) return
  field.value?.blur()
  emit('done')
}
function cancel() {
  draft.value = saved.value
  commitError.value = ''
  field.value?.blur()
}
function insert(id: string) {
  const reference = formula.reference(id)
  const literal = preview.value.result?.kind === 'literal'
  const range =
    literal || !selection.value ? { start: 0, end: draft.value.length } : selection.value
  draft.value = draft.value.slice(0, range.start) + reference + draft.value.slice(range.end)
  insertionCaret.value = range.start + reference.length
}
function restoreInputFocus(event: Event) {
  if (insertionCaret.value === null) return
  event.preventDefault()
  const caret = insertionCaret.value
  insertionCaret.value = null
  field.value?.focus()
  field.value?.setSelectionRange(caret, caret)
  selection.value = { start: caret, end: caret }
}
function detach() {
  try {
    const { resolved } = formula.parse(modeId, formula.format(variable.valuesByMode[modeId]))
    draft.value = tokenValueText(variable, resolved)
    apply()
  } catch (error) {
    commitError.value = error instanceof Error ? error.message : String(error)
  }
}
</script>

<template>
  <div :class="ui.field()">
    <div :class="ui.valueRow()">
      <TokenFormulaField
        ref="field"
        :id="fieldId"
        v-model="draft"
        :aria-label="label"
        :resolve="resolveReference"
        :aria-invalid="Boolean(error)"
        :aria-describedby="`${fieldId}-result`"
        :state="fieldState"
        @change="apply"
        @enter="done"
        @cancel="cancel"
        @selection="selection = $event"
      />
      <VariablePicker
        :items="pickerItems"
        :selected="alias"
        :state="alias ? 'bound' : 'unbound'"
        :trigger-label="variables.insertReference"
        :search-placeholder="variables.searchVariables"
        :empty-label="variables.noMatchingVariables"
        :detach-label="variables.detachVariable"
        @select="insert"
        @detach="detach"
        @close-auto-focus="restoreInputFocus"
      />
    </div>
    <p :id="`${fieldId}-result`" :class="resultClass" aria-live="polite">
      {{ resultText }}
    </p>
    <span v-if="preview.result?.kind === 'css'" :class="ui.hint()">{{
      variables.expressionHint
    }}</span>
  </div>
</template>
