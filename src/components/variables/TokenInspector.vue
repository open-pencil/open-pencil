<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { omit } from 'es-toolkit'
import { tv } from 'tailwind-variants'
import { computed, reactive, useId, watch } from 'vue'

import type { VariableTokenFields } from '@open-pencil/core/editor'
import {
  cssNameCodeSyntax,
  explicitCSSName,
  loadTokenValidator,
  parseCSSName,
  variableUnit
} from '@open-pencil/dom-css/export'
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
import { randomHex } from '@open-pencil/scene-graph/random'
import { useI18n } from '@open-pencil/vue'

import type { AliasCandidate, TokenRow } from '@/app/editor/tokens/model'
import { SCOPES_BY_TYPE } from '@/app/editor/tokens/scopes'
import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import { BindingPill, VariablePicker } from '@/components/ui/binding'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import FillSwatch from '@/components/ui/paint/FillSwatch.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'
import tokensPanelTheme from '@/theme/tokens-panel'

const {
  row,
  collection,
  aliasCandidates,
  layout = 'side'
} = defineProps<{
  row: TokenRow
  collection: VariableCollection
  /** Variables of the same type a mode's value can point at. */
  aliasCandidates: AliasCandidate[]
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
const ui = computed(() => tv(tokensPanelTheme)({ layout }))
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
const cssNameErrorId = `${useId()}-css-name`
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
  <aside :class="ui.inspector()" data-test-id="token-inspector">
    <section :class="ui.section()">
      <label :class="ui.field()">
        <span :class="ui.label()">{{ variables.name }}</span>
        <AppInput v-model="draft.name" size="sm" @change="commitName" @enter="done" />
      </label>
      <label :class="ui.field()">
        <span :class="ui.label()">{{ variables.cssName }}</span>
        <AppInput
          v-model="draft.cssName"
          size="sm"
          :placeholder="row.cssName"
          :state="cssNameInvalid ? 'invalid' : 'idle'"
          :aria-invalid="cssNameInvalid"
          :aria-describedby="cssNameInvalid ? cssNameErrorId : undefined"
          :ui="{ input: 'font-mono pl-7' }"
          data-test-id="variables-css-name"
          @change="commitCSSName"
          @enter="cssNameDone"
        >
          <template #leading><span :class="ui.prefix()">--</span></template>
        </AppInput>
        <p v-if="cssNameInvalid" :id="cssNameErrorId" :class="ui.error()" role="alert">
          {{ variables.cssNameInvalid }}
        </p>
        <span :class="ui.hint()">{{ variables.cssNameHint }}</span>
      </label>
      <label v-if="variable.type === 'FLOAT'" :class="ui.field()">
        <span :class="ui.label()">{{ variables.unit }}</span>
        <AppSelect v-model="unit" :options="unitOptions" />
      </label>
    </section>

    <section :class="ui.section()">
      <h3 :class="ui.sectionTitle()">{{ singleMode ? variables.value : variables.values }}</h3>
      <div v-for="mode in collection.modes" :key="mode.modeId" :class="ui.field()">
        <span v-if="!singleMode" :class="ui.label()">{{ mode.name }}</span>
        <div :class="ui.valueRow()">
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
        <AppInput
          v-if="variable.type === 'FLOAT' && !alias(mode.modeId)"
          v-model="draft.expressions[mode.modeId]"
          size="sm"
          :placeholder="variables.expression"
          :ui="{ input: 'font-mono' }"
          @change="commitExpression(mode.modeId)"
          @enter="done"
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
