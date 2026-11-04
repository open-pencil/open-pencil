<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, ref, useTemplateRef, watch } from 'vue'

import {
  cssExpressionProblem,
  loadTokenValidator,
  tokenNumberToCSS
} from '@open-pencil/dom-css/export'
import type { TokenUnit } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue/i18n'

import { cssExpressionPreview } from '@/app/editor/tokens/css-expression'
import type { CSSReferenceCandidate } from '@/app/editor/tokens/model'
import { VariablePicker } from '@/components/ui/binding'
import cssExpressionTheme from '@/theme/variables/css-expression'

import { cssValueDialect } from './formula-field/dialects/css'
import type { FormulaSelection } from './formula-field/source'
import type TokenFormulaField from './TokenFormulaField.vue'

/** A value only CSS can draw, shown where the field is empty. */
const EXAMPLE = 'clamp(1rem, 4vw, 1.5rem)'

const css = defineModel<string>({ required: true })
const { id, label, unit, candidates, describedBy } = defineProps<{
  id: string
  label: string
  unit: TokenUnit
  /** Number tokens the expression can name as `var(--name)`. */
  candidates: CSSReferenceCandidate[]
  describedBy: string
}>()
const emit = defineEmits<{ commit: [css: string]; cancel: [] }>()
const { variables } = useI18n()
const ui = tv(cssExpressionTheme)()
const field = useTemplateRef<InstanceType<typeof TokenFormulaField>>('field')

const reference = (candidate: CSSReferenceCandidate) => `var(--${candidate.cssName})`
const completions = computed(() =>
  candidates.map((candidate) => ({
    label: `--${candidate.cssName}`,
    section: candidate.collection,
    detail: candidate.text,
    insert: reference(candidate)
  }))
)
const byProperty = computed(
  () => new Map(candidates.map((candidate) => [`--${candidate.cssName}`, candidate]))
)
const pickerItems = computed(() =>
  candidates.map(({ id: candidateId, name, collection, text }) => ({
    id: candidateId,
    name,
    collection,
    text
  }))
)

/** The custom property in a `var()` shows as a pill of its name; the tooltip gives the token. */
function resolveReference(property: string) {
  const candidate = byProperty.value.get(property)
  if (!candidate) return undefined
  return {
    label: property,
    tooltip: `${candidate.collection} · ${candidate.name} · ${candidate.text}`
  }
}

/**
 * What the expression comes to, computed by the browser on a hidden probe with the tokens it
 * names, shown as the value field shows its result.
 */
const probe = useTemplateRef<HTMLDivElement>('probe')
function measure(property: string, value: string, variables: ReadonlyMap<string, string>) {
  const element = probe.value
  if (!element) return ''
  element.style.cssText = ''
  for (const [name, text] of variables) element.style.setProperty(name, text)
  element.style.setProperty(property, value)
  return getComputedStyle(element).getPropertyValue(property)
}
const preview = computed(() => {
  const text = css.value.trim()
  if (!text || error.value || !probe.value) return undefined
  const tokens = new Map(candidates.map((candidate) => [`--${candidate.cssName}`, candidate.text]))
  return cssExpressionPreview(text, unit, tokens, measure)
})
const previewText = computed(() =>
  preview.value ? tokenNumberToCSS(preview.value.value, unit) : undefined
)

/** Errors show once the expression is committed, as the value field's do. */
const error = ref('')
watch(css, () => (error.value = ''))
const validator = computedAsync(loadTokenValidator, null)
function message(text: string) {
  if (!validator.value) return ''
  const problem = cssExpressionProblem(
    text,
    unit,
    new Set(byProperty.value.keys()),
    validator.value,
    (property, value) => CSS.supports(property, value)
  )
  if (!problem) return ''
  if (problem.kind === 'unclosed') return variables.value.cssExpressionUnclosed
  if (problem.kind === 'syntax') return variables.value.cssExpressionSyntax
  if (problem.kind === 'negated-reference')
    return variables.value.cssExpressionNegated({ property: problem.property })
  if (problem.kind === 'unknown-token')
    return variables.value.cssExpressionUnknownToken({ name: problem.name })
  return variables.value.cssExpressionInvalid({ property: problem.property })
}
function commit() {
  const text = css.value.trim()
  error.value = text ? message(text) : ''
  if (error.value) return false
  emit('commit', text)
  return true
}
function enter() {
  if (commit()) field.value?.blur()
}

/** The picker puts `var(--name)` at the caret and gives the focus back to the field. */
const selection = ref<FormulaSelection | null>(null)
const insertionCaret = ref<number | null>(null)
function insert(candidateId: string) {
  const candidate = candidates.find((item) => item.id === candidateId)
  if (!candidate) return
  const text = reference(candidate)
  const range = selection.value ?? { start: css.value.length, end: css.value.length }
  css.value = css.value.slice(0, range.start) + text + css.value.slice(range.end)
  insertionCaret.value = range.start + text.length
}
function restoreFocus(event: Event) {
  if (insertionCaret.value === null) return
  event.preventDefault()
  const caret = insertionCaret.value
  insertionCaret.value = null
  field.value?.focus()
  field.value?.setSelectionRange(caret, caret)
}

defineExpose({ focus: () => field.value?.focus() })
</script>

<template>
  <!-- The field and its error sit in the value grid's first column, under the value field. -->
  <div class="contents">
    <div :class="ui.field()">
      <TokenFormulaField
        :id="id"
        ref="field"
        v-model="css"
        :dialect="cssValueDialect"
        :label="label"
        prefix="CSS"
        :placeholder="EXAMPLE"
        :completions="completions"
        :resolve="resolveReference"
        :invalid="Boolean(error)"
        :suffix="previewText"
        :approximate="preview?.approximate"
        :described-by="describedBy"
        @change="commit"
        @enter="enter"
        @cancel="emit('cancel')"
        @selection="selection = $event"
      >
        <template #actions>
          <VariablePicker
            :items="pickerItems"
            state="unbound"
            :trigger-label="variables.useVariable"
            :search-placeholder="variables.searchVariables"
            :empty-label="variables.noMatchingVariables"
            :detach-label="variables.detachVariable"
            @select="insert"
            @close-auto-focus="restoreFocus"
          />
        </template>
      </TokenFormulaField>
    </div>

    <p v-if="error" :class="[ui.error(), ui.field()]" role="alert">{{ error }}</p>
    <div ref="probe" :class="ui.probe()" aria-hidden="true" />
  </div>
</template>
