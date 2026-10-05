<script setup lang="ts">
import { omit } from 'es-toolkit'
import { tv } from 'tailwind-variants'
import { computed, reactive, watch } from 'vue'

import type { VariableTokenFields } from '@open-pencil/core/editor'
import { cssNameCodeSyntax, explicitCSSName, variableUnit } from '@open-pencil/dom-css/export'
import {
  TOKEN_UNITS,
  tokenNumberFromUnit,
  tokenNumberInUnit,
  type Color,
  type TokenExpression,
  type Variable,
  type VariableCollection,
  type VariableScope,
  type VariableValue
} from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import type { TokenRow } from '@/app/editor/tokens/model'
import { SCOPES_BY_TYPE } from '@/app/editor/tokens/scopes'
import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import BindingPill from '@/components/ui/binding/BindingPill.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'
import tokensPanelTheme from '@/theme/tokens-panel'

const {
  row,
  collection,
  layout = 'side'
} = defineProps<{
  row: TokenRow
  collection: VariableCollection
  /** `full` fills the panel behind a back button on narrow screens. */
  layout?: 'side' | 'full'
}>()
const emit = defineEmits<{
  rename: [name: string]
  updateToken: [patch: Partial<VariableTokenFields>]
  updateValue: [modeId: string, value: VariableValue]
  remove: []
}>()

const { variables } = useI18n()
const ui = computed(() => tv(tokensPanelTheme)({ layout }))
const variable = computed(() => row.variable)

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

function commitCSSName() {
  const name = draft.cssName.trim().replace(/^--/, '')
  if (name === (explicitCSSName(variable.value) ?? '')) return
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

/** An expression replaces a number in CSS; the stored number stays what the canvas draws. */
function commitExpression(modeId: string) {
  const css = (draft.expressions[modeId] ?? '').trim()
  const resolved = variable.value.valuesByMode[modeId]
  const others = omit(variable.value.expressions ?? {}, [modeId])
  const expressions: Record<string, TokenExpression> =
    css && typeof resolved === 'number' ? { ...others, [modeId]: { css, resolved } } : others
  emit('updateToken', {
    expressions: Object.keys(expressions).length > 0 ? expressions : undefined
  })
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

function color(modeId: string): Color | undefined {
  const value = variable.value.valuesByMode[modeId]
  return typeof value === 'object' && 'r' in value ? value : undefined
}
</script>

<template>
  <aside :class="ui.inspector()" data-test-id="token-inspector">
    <section :class="ui.section()">
      <label :class="ui.field()">
        <span :class="ui.label()">{{ variables.name }}</span>
        <AppInput v-model="draft.name" size="sm" @change="commitName" />
      </label>
      <label :class="ui.field()">
        <span :class="ui.label()">{{ variables.cssName }}</span>
        <AppInput
          v-model="draft.cssName"
          size="sm"
          :placeholder="`--${row.cssName}`"
          :ui="{ input: 'font-mono' }"
          @change="commitCSSName"
        />
        <span :class="ui.hint()">{{ variables.cssNameHint }}</span>
      </label>
      <label v-if="variable.type === 'FLOAT'" :class="ui.field()">
        <span :class="ui.label()">{{ variables.unit }}</span>
        <AppSelect v-model="unit" :options="unitOptions" />
      </label>
    </section>

    <section :class="ui.section()">
      <h3 :class="ui.sectionTitle()">{{ variables.values }}</h3>
      <div v-for="mode in collection.modes" :key="mode.modeId" :class="ui.field()">
        <span :class="ui.label()">{{ mode.name }}</span>
        <BindingPill v-if="alias(mode.modeId)" :label="alias(mode.modeId) ?? ''" />
        <ColorInput
          v-else-if="color(mode.modeId)"
          :color="color(mode.modeId) ?? { r: 0, g: 0, b: 0, a: 1 }"
          editable
          @update="emit('updateValue', mode.modeId, $event)"
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
        >
          <template v-if="variable.type === 'FLOAT' && numberUnit !== 'none'" #trailing>
            <span :class="ui.hint()">{{ numberUnit }}</span>
          </template>
        </AppInput>
        <AppInput
          v-if="variable.type === 'FLOAT' && !alias(mode.modeId)"
          v-model="draft.expressions[mode.modeId]"
          size="sm"
          :placeholder="variables.expression"
          :ui="{ input: 'font-mono' }"
          @change="commitExpression(mode.modeId)"
        />
      </div>
      <span v-if="variable.type === 'FLOAT'" :class="ui.hint()">{{
        variables.expressionHint
      }}</span>
    </section>

    <section v-if="scopes.length > 0" :class="ui.section()">
      <h3 :class="ui.sectionTitle()">{{ variables.scopes }}</h3>
      <label
        v-for="scope in scopes"
        :key="scope"
        class="flex items-center gap-2 text-xs text-surface"
      >
        <AppCheckbox
          :model-value="hasScope(scope)"
          :ariaLabel="SCOPE_MESSAGES[scope]?.() ?? scope"
          @update:model-value="toggleScope(scope, $event)"
        />
        {{ SCOPE_MESSAGES[scope]?.() ?? scope }}
      </label>
    </section>

    <section :class="ui.section()">
      <h3 :class="ui.sectionTitle()">{{ variables.description }}</h3>
      <AppTextarea v-model="draft.description" :rows="2" @change="commitDescription" />
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
