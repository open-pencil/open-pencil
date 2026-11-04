<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { isEmptyObject, omit } from 'es-toolkit'
import { tv } from 'tailwind-variants'
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'

import type { VariableTokenFields } from '@open-pencil/core'
import {
  cssNameCodeSyntax,
  explicitCSSName,
  loadTokenValidator,
  parseCSSName,
  variableUnit
} from '@open-pencil/dom-css/export'
import {
  TOKEN_UNITS,
  type TokenExpression,
  type Variable,
  type VariableCollection,
  type VariableScope,
  type VariableValue
} from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { randomHex } from '@open-pencil/scene-graph/random'
import { tokenNumberFromUnit, tokenNumberInUnit } from '@open-pencil/scene-graph/variables'
import { useI18n } from '@open-pencil/vue/i18n'

import type {
  AliasCandidate,
  CSSReferenceCandidate,
  TokenFormulaActions,
  TokenRow
} from '@/app/editor/tokens/model'
import { SCOPES_BY_TYPE } from '@/app/editor/tokens/scopes'
import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import { BindingPill, VariablePicker } from '@/components/ui/binding'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import FillSwatch from '@/components/ui/paint/FillSwatch.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'
import inspectorTheme from '@/theme/variables/inspector'

import TokenCSSExpression from './TokenCSSExpression.vue'
import TokenValueEditor from './TokenValueEditor.vue'

const {
  row,
  collection,
  aliasCandidates,
  cssCandidates = [],
  formula,
  layout = 'side'
} = defineProps<{
  row: TokenRow
  collection: VariableCollection
  /** Variables of the same type a mode's value can point at. */
  aliasCandidates: AliasCandidate[]
  /** Number tokens a CSS expression can name as `var(--name)`. */
  cssCandidates?: CSSReferenceCandidate[]
  /** Reads and writes number and true/false values, which may be formulas. */
  formula?: TokenFormulaActions
  /** `full` fills the panel behind a back button on narrow screens. */
  layout?: 'side' | 'full'
}>()
const emit = defineEmits<{
  done: []
  rename: [name: string]
  updateToken: [patch: Partial<VariableTokenFields>]
  updateValue: [modeId: string, value: VariableValue, coalesceKey?: string]
  alias: [modeId: string, variableId: string]
  detach: [modeId: string]
  remove: []
}>()

const { variables } = useI18n()
const ui = computed(() => tv(inspectorTheme)({ layout }))
/**
 * A copy per list refresh: the graph edits a variable in place, so the same object coming back
 * would not tell the fields an inline rename or an undo changed it.
 */
const variable = computed(() => ({ ...row.variable }))

const SCOPE_MESSAGES: Partial<Record<VariableScope, () => string>> = {
  ALL_FILLS: () => variables.value.scopeAllFills,
  FRAME_FILL: () => variables.value.scopeFrameFill,
  SHAPE_FILL: () => variables.value.scopeShapeFill,
  TEXT_FILL: () => variables.value.scopeTextFill,
  STROKE: () => variables.value.scopeStroke,
  EFFECT_COLOR: () => variables.value.scopeEffectColor,
  CORNER_RADIUS: () => variables.value.scopeCornerRadius,
  WIDTH_HEIGHT: () => variables.value.scopeWidthHeight,
  GAP: () => variables.value.scopeGap,
  STROKE_FLOAT: () => variables.value.scopeStrokeFloat,
  OPACITY: () => variables.value.scopeOpacity,
  EFFECT_FLOAT: () => variables.value.scopeEffectFloat,
  FONT_STYLE: () => variables.value.scopeFontStyle,
  FONT_SIZE: () => variables.value.scopeFontSize,
  LINE_HEIGHT: () => variables.value.scopeLineHeight,
  LETTER_SPACING: () => variables.value.scopeLetterSpacing,
  PARAGRAPH_SPACING: () => variables.value.scopeParagraphSpacing,
  PARAGRAPH_INDENT: () => variables.value.scopeParagraphIndent,
  TEXT_CONTENT: () => variables.value.scopeTextContent,
  FONT_FAMILY: () => variables.value.scopeFontFamily
}

const scopes = computed(() => SCOPES_BY_TYPE[variable.value.type])

/** Numbers are edited in the token's unit, `1.5` for a 24px `rem` token, and stored as pixels. */
const numberUnit = computed(() => variableUnit(variable.value))

function displayValue(value: VariableValue | undefined): string {
  if (typeof value === 'number')
    return String(Number(tokenNumberInUnit(value, numberUnit.value).toFixed(6)))
  return typeof value === 'object' ? '' : String(value ?? '')
}

const unitOptions = computed(() => [
  { value: 'auto', label: variables.value.unitAuto },
  ...TOKEN_UNITS.map((unit) => ({ value: unit, label: unit }))
])

const unit = computed({
  get: () => variable.value.unit ?? 'auto',
  set: (value: string) =>
    emit('updateToken', { unit: TOKEN_UNITS.find((candidate) => candidate === value) })
})

/** Text fields edit a draft and commit on change, so typing makes one undo step, not many. */
const draft = reactive({
  name: '',
  cssName: '',
  description: '',
  values: {} as Record<string, string>,
  expressions: {} as Record<string, string>
})

function resetDraft(current: Variable) {
  draft.name = current.name
  draft.cssName = explicitCSSName(current) ?? ''
  draft.description = current.description
  for (const mode of collection.modes) {
    draft.values[mode.modeId] = displayValue(current.valuesByMode[mode.modeId])
    draft.expressions[mode.modeId] = current.expressions?.[mode.modeId]?.css ?? ''
  }
}
/**
 * Drafts reset when the token's stored fields change, by edit or undo, not whenever the list is
 * re-read, so a scene change does not discard what is being typed.
 */
watch(
  () => {
    const { id, name, description, valuesByMode, expressions } = variable.value
    return JSON.stringify([
      id,
      name,
      explicitCSSName(variable.value),
      description,
      valuesByMode,
      expressions
    ])
  },
  () => resetDraft(variable.value),
  { immediate: true }
)

function commitName() {
  const name = draft.name.trim()
  if (name && name !== variable.value.name) emit('rename', name)
  else draft.name = variable.value.name
}

/** The browser's CSS parser decides what a custom property name may be. */
const validator = computedAsync(loadTokenValidator, null)
const fieldId = useId()
const nameId = `${fieldId}-name`
const unitId = `${fieldId}-unit`
const cssNameId = `${fieldId}-css-name`
const cssNameErrorId = `${cssNameId}-error`
const cssNameHintId = `${cssNameErrorId}-hint`
/** The name typed, without the `--` the field shows, also when `--name` or `var(--name)` is pasted. */
const typedCSSName = computed(() => {
  const text = draft.cssName.trim()
  return parseCSSName(text) ?? text
})
const cssNameInvalid = computed(() => {
  const name = typedCSSName.value
  return name !== '' && validator.value !== null && !validator.value.name(name)
})

function commitCSSName() {
  const name = typedCSSName.value
  draft.cssName = name
  if (cssNameInvalid.value || name === (explicitCSSName(variable.value) ?? '')) return
  emit('updateToken', {
    codeSyntax: { ...variable.value.codeSyntax, WEB: name ? cssNameCodeSyntax(name) : undefined }
  })
}

function commitDescription() {
  if (draft.description !== variable.value.description)
    emit('updateToken', { description: draft.description })
}

function commitValue(modeId: string) {
  const text = draft.values[modeId] ?? ''
  if (variable.value.type === 'FLOAT') {
    const number = Number(text)
    if (text.trim() && Number.isFinite(number))
      emit('updateValue', modeId, tokenNumberFromUnit(number, numberUnit.value))
    else resetDraft(variable.value)
    return
  }
  emit('updateValue', modeId, text)
}

/**
 * An expression replaces a mode's value in CSS alone; the canvas keeps drawing the value. It
 * records a plain number, so a number edited elsewhere later shows it no longer applies.
 */
function commitExpression(modeId: string, css: string) {
  addingExpression.value = null
  if (css === (variable.value.expressions?.[modeId]?.css ?? '')) return
  const value = variable.value.valuesByMode[modeId]
  const others = omit(variable.value.expressions ?? {}, [modeId])
  const expression: TokenExpression = typeof value === 'number' ? { css, resolved: value } : { css }
  const expressions = css ? { ...others, [modeId]: expression } : others
  emit('updateToken', { expressions: isEmptyObject(expressions) ? undefined : expressions })
}

/** The mode whose expression field was asked for, which shows until it is committed. */
const addingExpression = ref<string | null>(null)
const expressionId = `${useId()}-expression`
watch(
  () => variable.value.id,
  () => (addingExpression.value = null)
)
function showsExpression(modeId: string) {
  return addingExpression.value === modeId || Boolean(variable.value.expressions?.[modeId])
}
function addExpression(modeId: string) {
  addingExpression.value = modeId
  void nextTick(() => document.getElementById(`${expressionId}-${modeId}`)?.focus())
}
/** Escape restores the saved expression; a field asked for and left empty closes again. */
function cancelExpression(modeId: string) {
  draft.expressions[modeId] = variable.value.expressions?.[modeId]?.css ?? ''
  addingExpression.value = null
}
function clearExpression(modeId: string) {
  draft.expressions[modeId] = ''
  commitExpression(modeId, '')
}

/**
 * Values edit in the value editor, which takes formulas: numbers and true/false values always,
 * and text and colors when they are written as they are or as a formula, since a text or color
 * variable keeps its pill and a composed color its swatch.
 */
function usesValueEditor(modeId: string) {
  if (!formula) return false
  if (variable.value.type === 'FLOAT' || variable.value.type === 'BOOLEAN') return true
  const value = variable.value.valuesByMode[modeId]
  if (value === undefined || typeof value !== 'object') return value !== undefined
  if ('aliasId' in value) return false
  return !('expression' in value) || value.expression === 'FORMULA'
}

function hasScope(scope: VariableScope) {
  return variable.value.scopes?.includes(scope) ?? false
}

function toggleScope(scope: VariableScope, on: boolean) {
  const current = (variable.value.scopes ?? []).filter((candidate) => candidate !== 'ALL_SCOPES')
  const next = on ? [...current, scope] : current.filter((candidate) => candidate !== scope)
  emit('updateToken', { scopes: next.length > 0 ? next : undefined })
}

function alias(modeId: string) {
  return row.values.find((value) => value.modeId === modeId)?.alias
}

/** A function from the file OpenPencil cannot evaluate; that mode's value is read-only. */
function unsupported(modeId: string) {
  return row.values.find((value) => value.modeId === modeId)?.unsupported
}

/** The color an aliased value resolves to, shown beside the variable as the panel does. */
function aliasColor(modeId: string): Color | undefined {
  return row.values.find((value) => value.modeId === modeId)?.color
}

function aliasId(modeId: string): string | undefined {
  const value = variable.value.valuesByMode[modeId]
  return typeof value === 'object' && 'aliasId' in value ? value.aliasId : undefined
}

/**
 * The modes whose color picker is open, each with the key its drag shares, so one picker session
 * is one undo step however many colors it passes through.
 */
const colorSessions = new Map<string, string>()

function setPickerOpen(modeId: string, open: boolean) {
  // A fresh key each time, so a session never merges into the last one, even across remounts.
  if (open) colorSessions.set(modeId, `variable-color:${variable.value.id}:${randomHex(8)}`)
  else colorSessions.delete(modeId)
}

function colorGesture(modeId: string): string | undefined {
  return colorSessions.get(modeId)
}

/** With one mode the value needs no mode name above it. */
const singleMode = computed(() => collection.modes.length === 1)

function color(modeId: string): Color | undefined {
  const value = variable.value.valuesByMode[modeId]
  return typeof value === 'object' && 'r' in value ? value : undefined
}

/** Enter commits the field and hands the keyboard back to the list, so undo reaches the document. */
function done(event: KeyboardEvent) {
  if (event.target instanceof HTMLElement) event.target.blur()
  emit('done')
}

/** A name the field refuses keeps the focus, so it can be corrected. */
function cssNameDone(event: KeyboardEvent) {
  if (!cssNameInvalid.value) done(event)
}
</script>

<template>
  <aside :class="ui.root()" data-test-id="token-inspector">
    <section :class="ui.section()">
      <PanelFieldGroup :label="variables.name" :for="nameId">
        <AppInput :id="nameId" v-model="draft.name" size="sm" @change="commitName" @enter="done" />
      </PanelFieldGroup>
      <PanelFieldGroup :label="variables.cssName" :for="cssNameId">
        <Tip :label="variables.cssNameHint">
          <AppInput
            :id="cssNameId"
            v-model="draft.cssName"
            size="sm"
            :placeholder="row.cssName"
            :state="cssNameInvalid ? 'invalid' : 'idle'"
            :aria-invalid="cssNameInvalid"
            :aria-describedby="cssNameInvalid ? cssNameErrorId : cssNameHintId"
            :ui="{ input: 'font-mono pl-7' }"
            data-test-id="variables-css-name"
            @change="commitCSSName"
            @enter="cssNameDone"
          >
            <template #leading><span :class="ui.prefix()">--</span></template>
          </AppInput>
        </Tip>
        <p v-if="cssNameInvalid" :id="cssNameErrorId" :class="ui.error()" role="alert">
          {{ variables.cssNameInvalid }}
        </p>
        <span :id="cssNameHintId" class="sr-only">{{ variables.cssNameHint }}</span>
      </PanelFieldGroup>
      <PanelFieldGroup v-if="variable.type === 'FLOAT'" :label="variables.unit" :for="unitId">
        <AppSelect :id="unitId" v-model="unit" :options="unitOptions" />
      </PanelFieldGroup>
    </section>

    <section :class="ui.section()">
      <!-- A value editor heads itself, its tools on its label's row; the section title is for several. -->
      <h3 v-if="!singleMode || !usesValueEditor(collection.defaultModeId)" :class="ui.title()">
        {{ singleMode ? variables.value : variables.values }}
      </h3>
      <div v-for="mode in collection.modes" :key="mode.modeId" :class="ui.value()">
        <span
          v-if="!singleMode && (!usesValueEditor(mode.modeId) || unsupported(mode.modeId))"
          :class="ui.label()"
          >{{ mode.name }}</span
        >
        <Tip
          v-if="unsupported(mode.modeId)"
          :label="variables.unsupportedExpression({ name: unsupported(mode.modeId) ?? '' })"
        >
          <span :class="ui.hint()">{{ unsupported(mode.modeId) }}(…)</span>
        </Tip>
        <TokenValueEditor
          v-else-if="usesValueEditor(mode.modeId) && formula"
          :variable="variable"
          :mode-id="mode.modeId"
          :label="singleMode ? variables.value : mode.name"
          :heading="singleMode ? 'section' : 'mode'"
          :candidates="aliasCandidates"
          :formula="formula"
          :expression="variable.type === 'FLOAT' ? showsExpression(mode.modeId) : undefined"
          @apply="emit('updateValue', mode.modeId, $event)"
          @done="emit('done')"
          @add-expression="addExpression(mode.modeId)"
          @remove-expression="clearExpression(mode.modeId)"
        >
          <template #control>
            <ColorInput
              v-if="color(mode.modeId)"
              :color="color(mode.modeId) ?? { r: 0, g: 0, b: 0, a: 1 }"
              editable
              @update="emit('updateValue', mode.modeId, $event, colorGesture(mode.modeId))"
              @open-change="setPickerOpen(mode.modeId, $event)"
            />
            <AppInput
              v-else
              v-model="draft.values[mode.modeId]"
              :aria-label="singleMode ? variables.value : mode.name"
              size="sm"
              @change="commitValue(mode.modeId)"
              @enter="done"
            />
          </template>
          <template #below>
            <TokenCSSExpression
              v-if="showsExpression(mode.modeId)"
              :id="`${expressionId}-${mode.modeId}`"
              v-model="draft.expressions[mode.modeId]"
              :label="singleMode ? variables.expression : `${mode.name}: ${variables.expression}`"
              :unit="numberUnit"
              :candidates="cssCandidates"
              :described-by="`${expressionId}-hint`"
              @commit="commitExpression(mode.modeId, $event)"
              @cancel="cancelExpression(mode.modeId)"
            />
          </template>
        </TokenValueEditor>
        <div v-else :class="ui.valueRow()">
          <div v-if="alias(mode.modeId)" :class="ui.valueControl()">
            <FillSwatch
              v-if="aliasColor(mode.modeId)"
              :fill="{
                type: 'SOLID',
                visible: true,
                opacity: aliasColor(mode.modeId)?.a ?? 1,
                color: aliasColor(mode.modeId) ?? { r: 0, g: 0, b: 0, a: 1 }
              }"
              :ui="{ root: 'size-5 shrink-0' }"
            />
            <BindingPill class="min-w-0 flex-1" :label="alias(mode.modeId) ?? ''" />
          </div>
          <ColorInput
            v-else-if="color(mode.modeId)"
            :color="color(mode.modeId) ?? { r: 0, g: 0, b: 0, a: 1 }"
            editable
            @update="emit('updateValue', mode.modeId, $event, colorGesture(mode.modeId))"
            @open-change="setPickerOpen(mode.modeId, $event)"
          />
          <AppCheckbox
            v-else-if="variable.type === 'BOOLEAN'"
            :model-value="variable.valuesByMode[mode.modeId] === true"
            :ariaLabel="mode.name"
            @update:model-value="emit('updateValue', mode.modeId, $event)"
          />
          <AppInput
            v-else
            v-model="draft.values[mode.modeId]"
            :type="variable.type === 'FLOAT' ? 'number' : 'text'"
            size="sm"
            @change="commitValue(mode.modeId)"
            @enter="done"
          >
            <template v-if="variable.type === 'FLOAT' && numberUnit !== 'none'" #trailing>
              <span :class="ui.hint()">{{ numberUnit }}</span>
            </template>
          </AppInput>
          <VariablePicker
            :items="aliasCandidates"
            :selected="aliasId(mode.modeId)"
            :state="aliasId(mode.modeId) ? 'bound' : 'unbound'"
            :trigger-label="
              singleMode ? variables.useVariable : `${mode.name}: ${variables.useVariable}`
            "
            :search-placeholder="variables.searchVariables"
            :empty-label="variables.noMatchingVariables"
            :detach-label="variables.detachVariable"
            side="left"
            data-test-id="variables-use-variable"
            @select="emit('alias', mode.modeId, $event)"
            @detach="emit('detach', mode.modeId)"
          />
        </div>
      </div>
      <span :id="`${expressionId}-hint`" class="sr-only">{{ variables.expressionHint }}</span>
    </section>

    <section v-if="scopes.length > 0" :class="ui.section()">
      <h3 :class="ui.title()">{{ variables.scopes }}</h3>
      <label v-for="scope in scopes" :key="scope" :class="ui.scope()">
        <AppCheckbox
          :model-value="hasScope(scope)"
          :ariaLabel="SCOPE_MESSAGES[scope]?.() ?? scope"
          @update:model-value="toggleScope(scope, $event)"
        />
        {{ SCOPE_MESSAGES[scope]?.() ?? scope }}
      </label>
    </section>

    <section :class="ui.section()">
      <h3 :class="ui.title()">{{ variables.description }}</h3>
      <AppTextarea v-model="draft.description" :rows="2" @change="commitDescription" />
    </section>

    <section :class="ui.section()">
      <label class="flex items-center gap-2 text-xs text-surface">
        <AppCheckbox
          :model-value="variable.hiddenFromPublishing"
          :ariaLabel="variables.hiddenFromPublishing"
          data-test-id="variables-hidden-from-publishing"
          @update:model-value="emit('updateToken', { hiddenFromPublishing: $event })"
        />
        {{ variables.hiddenFromPublishing }}
      </label>
      <span :class="ui.hint()">{{ variables.hiddenFromPublishingHint }}</span>
    </section>

    <section :class="ui.section()">
      <AppButton
        variant="ghost"
        color="error"
        size="sm"
        class="self-start"
        data-test-id="variables-delete-variable"
        @click="emit('remove')"
      >
        <template #leading><icon-lucide-trash-2 class="size-3.5" /></template>
        {{ variables.deleteVariable }}
      </AppButton>
    </section>
  </aside>
</template>
