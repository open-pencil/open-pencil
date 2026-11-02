<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'

import { tokenNumberToCSS, variableUnit } from '@open-pencil/dom-css/export'
import type { Variable, VariableLiteral, VariableValue } from '@open-pencil/scene-graph'
import { colorToHex8 } from '@open-pencil/scene-graph/color'
import { formulaSymbol } from '@open-pencil/scene-graph/variables'
import { useI18n } from '@open-pencil/vue/i18n'

import {
  referencePillName,
  type AliasCandidate,
  type TokenFormulaActions
} from '@/app/editor/tokens/model'
import { parseTokenEditorText, tokenEditorText } from '@/app/editor/tokens/value-editor'
import { VariablePicker } from '@/components/ui/binding'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import valueEditorTheme from '@/theme/variables/value-editor'

import { formulaDialect } from './formula-field/dialects/formula'
import type { FormulaSelection } from './formula-field/source'
import type TokenFormulaField from './TokenFormulaField.vue'

const {
  variable,
  modeId,
  label,
  heading = 'mode',
  candidates,
  formula,
  expression
} = defineProps<{
  variable: Variable
  modeId: string
  label: string
  /** A lone value's label reads as the section's title; one of several, as its mode's name. */
  heading?: 'section' | 'mode'
  candidates: AliasCandidate[]
  formula: TokenFormulaActions
  /** Whether the mode has a CSS expression; left out where the value takes none. */
  expression?: boolean
}>()
const emit = defineEmits<{
  apply: [value: VariableValue]
  done: []
  addExpression: []
  removeExpression: []
}>()
const { variables } = useI18n()
const ui = computed(() => tv(valueEditorTheme)({ heading }))
const fieldId = useId()
const field = useTemplateRef<InstanceType<typeof TokenFormulaField>>('field')

const draft = ref('')
const selection = ref<FormulaSelection | null>(null)
const insertionCaret = ref<number | null>(null)
/** Errors show once a value is committed, not while it is being typed. */
const committed = ref(false)
const commitError = ref('')
/**
 * A true/false, text or color value shows its own control, a switch or the `control` slot, until
 * the user asks to write a formula instead.
 */
const writingFormula = ref(false)

const value = computed(() => variable.valuesByMode[modeId])
const saved = computed(() => tokenEditorText(variable, modeId, formula))
/** A value written as it is: not a variable and not a formula. */
function isLiteral(of: VariableValue | undefined) {
  return of !== undefined && (typeof of !== 'object' || !('aliasId' in of || 'expression' in of))
}
const showsControl = computed(
  () => variable.type !== 'FLOAT' && isLiteral(value.value) && !writingFormula.value
)
const alias = computed(() =>
  typeof value.value === 'object' && 'aliasId' in value.value ? value.value.aliasId : undefined
)

function reset() {
  draft.value = saved.value
  selection.value = null
  insertionCaret.value = null
  committed.value = false
  commitError.value = ''
}
watch([() => variable.id, () => modeId], () => {
  writingFormula.value = false
  reset()
})
watch(saved, reset, { immediate: true })
watch(draft, () => {
  committed.value = false
  commitError.value = ''
})

/** A resolved value as the list shows it: a number with its unit, true and false, quoted text, or a hex color. */
function resultText(resolved: VariableLiteral | undefined) {
  if (typeof resolved === 'number') return tokenNumberToCSS(resolved, variableUnit(variable))
  if (typeof resolved === 'boolean') return String(resolved)
  if (typeof resolved === 'string') return JSON.stringify(resolved)
  if (typeof resolved === 'object') return colorToHex8(resolved)
  return '—'
}

/** A candidate's value in this mode; one of another type, compared in a formula, shows its own. */
function withValue(candidate: AliasCandidate) {
  try {
    const { resolved } = formula.parse(modeId, formula.reference(candidate.id))
    return { ...candidate, text: resultText(resolved) }
  } catch {
    return { ...candidate, text: candidate.text ?? '—' }
  }
}
const pickerItems = computed(() => candidates.map(withValue))
const referenceItems = computed(() => formula.candidates.map(withValue))
/** The functions a formula calls, after the variables, each with what it takes. */
const functionCompletions = computed(() =>
  (
    [
      ['if', variables.value.formulaIf],
      ['text', variables.value.formulaText],
      ['truthy', variables.value.formulaTruthy]
    ] as const
  ).map(([operator, detail]) => ({
    label: formulaSymbol(operator),
    section: variables.value.formulaFunctions,
    detail,
    insert: `${formulaSymbol(operator)}(`,
    kind: 'function' as const
  }))
)
const completions = computed(() => [
  ...referenceItems.value.map((item) => ({
    label: item.name,
    section: item.collection,
    detail: item.text,
    insert: formula.reference(item.id)
  })),
  ...functionCompletions.value
])
const candidatesBySource = computed(
  () => new Map(referenceItems.value.map((item) => [formula.reference(item.id), item]))
)
const candidatesById = computed(() => new Map(referenceItems.value.map((item) => [item.id, item])))

/** A reference's pill: found by its spelling, or by resolving another spelling of the name. */
function resolveReference(source: string) {
  const candidate = candidatesBySource.value.get(source) ?? candidateNamed(source)
  // The pill names the variable as its group row does; the tooltip gives the full path.
  if (candidate)
    return {
      label: referencePillName(candidate.name),
      tooltip: `${candidate.collection} · ${candidate.name} · ${candidate.text}`
    }
}
function candidateNamed(source: string) {
  try {
    const parsed = formula.parse(modeId, source).value
    if (typeof parsed === 'object' && 'aliasId' in parsed)
      return candidatesById.value.get(parsed.aliasId)
  } catch {
    // Incomplete or invalid references stay editable source text.
    return undefined
  }
}

const preview = computed(() => {
  try {
    return { edit: parseTokenEditorText(variable, modeId, draft.value, formula), error: '' }
  } catch (error) {
    return { edit: undefined, error: error instanceof Error ? error.message : String(error) }
  }
})
const error = computed(() => commitError.value || (committed.value ? preview.value.error : ''))
const suffix = computed(() => {
  const edit = preview.value.edit
  return edit && edit.kind !== 'literal' ? resultText(edit.resolved) : undefined
})
/** A plain number reads in its unit, as the number field showed it. */
const unit = computed(() => {
  const literal = !draft.value.trim() || preview.value.edit?.kind === 'literal'
  const name = variableUnit(variable)
  return variable.type === 'FLOAT' && literal && name !== 'none' ? name : undefined
})

function apply() {
  committed.value = true
  if (draft.value === saved.value) {
    if (isLiteral(value.value)) writingFormula.value = false
    return true
  }
  const edit = preview.value.edit
  if (!edit) return false
  emit('apply', edit.value)
  if (isLiteral(edit.value)) writingFormula.value = false
  return true
}
function done() {
  if (!apply()) return
  field.value?.blur()
  emit('done')
}
function cancel() {
  reset()
  writingFormula.value = false
  field.value?.blur()
}

const offersFormula = computed(() => showsControl.value)
async function writeFormula() {
  writingFormula.value = true
  await nextTick()
  field.value?.focus()
  field.value?.setSelectionRange(0, draft.value.length)
}
/** One button adds a CSS expression, focusing its field, and removes the one there is. */
function toggleExpression() {
  if (expression) emit('removeExpression')
  else emit('addExpression')
}

/** A literal is replaced by the variable; inside a formula, the variable goes at the caret. */
function insert(id: string) {
  const reference = formula.reference(id)
  if (showsControl.value || preview.value.edit?.kind === 'literal' || !selection.value) {
    const parsed = formula.parse(modeId, reference)
    emit('apply', parsed.value)
    return
  }
  const range = selection.value
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
/** The variable button sits at the field's end, or beside the control, as in the properties panel. */
const picker = computed(() => ({
  items: pickerItems.value,
  selected: alias.value,
  state: alias.value ? ('bound' as const) : ('unbound' as const),
  triggerLabel: variables.value.useVariable,
  searchPlaceholder: variables.value.searchVariables,
  emptyLabel: variables.value.noMatchingVariables,
  detachLabel: variables.value.detachVariable,
  onSelect: insert,
  onDetach: detach,
  onCloseAutoFocus: restoreInputFocus
}))
function detach() {
  try {
    const { resolved } = formula.parse(modeId, formula.format(value.value))
    emit('apply', resolved)
  } catch (error) {
    commitError.value = error instanceof Error ? error.message : String(error)
  }
}
</script>

<template>
  <div :class="ui.root()">
    <div :class="ui.header()">
      <span :class="ui.label()">{{ label }}</span>
      <span :class="ui.tools()">
        <IconButton
          v-if="offersFormula"
          :label="variables.useFormula"
          data-test-id="variables-use-formula"
          @click="writeFormula"
        >
          <icon-lucide-square-function class="size-3.5" />
        </IconButton>
        <IconButton
          v-if="expression !== undefined"
          :label="expression ? variables.removeExpression : variables.addExpression"
          :active="expression"
          toggle
          data-test-id="variables-css-expression"
          @click="toggleExpression"
        >
          <icon-lucide-code class="size-3.5" />
        </IconButton>
      </span>
    </div>
    <div v-if="showsControl" :class="ui.control()">
      <AppSwitch
        v-if="variable.type === 'BOOLEAN'"
        :model-value="value === true"
        :label="label"
        @update:model-value="emit('apply', $event)"
      />
      <!-- Text and colors edit in the inspector's own field and color picker. -->
      <slot v-else name="control" />
      <VariablePicker v-bind="picker" />
    </div>
    <TokenFormulaField
      v-else
      ref="field"
      :id="fieldId"
      v-model="draft"
      :dialect="formulaDialect"
      :label="label"
      :placeholder="variables.formulaPlaceholder"
      :resolve="resolveReference"
      :completions="completions"
      :invalid="Boolean(error)"
      :described-by="`${fieldId}-result`"
      :suffix="suffix"
      :unit="unit"
      @change="apply"
      @enter="done"
      @cancel="cancel"
      @selection="selection = $event"
    >
      <template #actions><VariablePicker v-bind="picker" /></template>
    </TokenFormulaField>
    <p :id="`${fieldId}-result`" :class="error ? ui.error() : 'sr-only'" aria-live="polite">
      {{ error || suffix }}
    </p>
    <!-- Fields that belong to this value, such as its CSS expression, follow it. -->
    <slot name="below" />
  </div>
</template>
