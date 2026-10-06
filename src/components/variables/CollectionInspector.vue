<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, reactive, useId, watch } from 'vue'

import { defaultModeAttributeName } from '@open-pencil/dom-css/export'
import { isModeAttributeName, type VariableCollection } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import {
  changeConditionKind,
  isAutomaticCondition,
  modeConditionCSS,
  parseModeCondition,
  type ConditionKind,
  type ModeCondition
} from '@/app/editor/tokens/conditions'
import { modeAttributeText, modeConditionPlaceholder } from '@/app/editor/tokens/model'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { useConditionLabels } from '@/components/variables/useConditionLabels'
import tokensPanelTheme from '@/theme/tokens-panel'

const { collection, layout = 'side' } = defineProps<{
  collection: VariableCollection
  /** `full` fills the panel behind a back button on narrow screens. */
  layout?: 'side' | 'full'
}>()
const emit = defineEmits<{
  done: []
  rename: [name: string]
  remove: []
  setModeAttribute: [name: string]
  addMode: []
  renameMode: [modeId: string, name: string]
  duplicateMode: [modeId: string]
  setDefaultMode: [modeId: string]
  removeMode: [modeId: string]
  setCondition: [modeId: string, condition: string]
}>()

const { variables } = useI18n()
const { kindOptions } = useConditionLabels()
const ui = computed(() => tv(tokensPanelTheme)({ layout }))
const menu = useMenuUI({ content: 'w-44', item: 'justify-start gap-2' })
const dangerItem = useMenuUI({ item: 'justify-start gap-2 text-error' }).item

/** Text fields edit a draft and commit on change, like the token fields. */
const draft = reactive({
  name: '',
  attribute: '',
  modeNames: {} as Record<string, string>,
  custom: {} as Record<string, string>,
  widths: {} as Record<string, string>
})
/**
 * Drafts reset when the stored names or conditions change, not whenever the collection is
 * re-read, so a selection change does not discard what is being typed.
 */
watch(
  () =>
    JSON.stringify([
      collection.name,
      collection.modeAttribute ?? '',
      collection.modes.map((mode) => [mode.modeId, mode.name, mode.condition ?? ''])
    ]),
  () => {
    draft.name = collection.name
    draft.attribute = collection.modeAttribute ?? ''
    for (const mode of collection.modes) {
      const condition = parseModeCondition(mode.condition)
      draft.modeNames[mode.modeId] = mode.name
      draft.custom[mode.modeId] = mode.condition ?? ''
      draft.widths[mode.modeId] = 'width' in condition ? String(condition.width) : ''
    }
  },
  { immediate: true }
)

function commitName() {
  const name = draft.name.trim()
  if (name && name !== collection.name) emit('rename', name)
  else draft.name = collection.name
}

const attributeErrorId = `${useId()}-attribute`
/** Blank restores the default; anything else must be an attribute a selector can name as is. */
const attributeInvalid = computed(() => {
  const name = draft.attribute.trim()
  return name !== '' && !isModeAttributeName(name)
})

/** A manual mode's selector, so the hint shows what the attribute switches. */
const attributeExample = computed(() => {
  const manual = collection.modes.find(
    (candidate) => candidate.modeId !== collection.defaultModeId && !candidate.condition
  )
  return (manual && modeConditionPlaceholder(collection, manual.modeId)) ?? ''
})

function commitAttribute() {
  if (attributeInvalid.value) return
  const name = draft.attribute.trim()
  if (name !== (collection.modeAttribute ?? '')) emit('setModeAttribute', name)
}

function mode(modeId: string) {
  return collection.modes.find((candidate) => candidate.modeId === modeId)
}

function commitModeName(modeId: string) {
  const name = (draft.modeNames[modeId] ?? '').trim()
  const current = mode(modeId)?.name ?? ''
  if (name && name !== current) emit('renameMode', modeId, name)
  else draft.modeNames[modeId] = current
}

function condition(modeId: string): ModeCondition {
  return parseModeCondition(mode(modeId)?.condition)
}

function save(modeId: string, next: ModeCondition) {
  const css = modeConditionCSS(next) ?? ''
  if (css !== (mode(modeId)?.condition ?? '')) emit('setCondition', modeId, css)
}

/** Custom CSS starts from what the mode writes now, the attribute selector when manual. */
function setKind(modeId: string, kind: ConditionKind) {
  const next = changeConditionKind(condition(modeId), kind)
  if (next.kind === 'custom' && !next.css)
    save(modeId, { kind: 'custom', css: modeConditionPlaceholder(collection, modeId) ?? '' })
  else save(modeId, next)
}

function commitWidth(modeId: string) {
  const current = condition(modeId)
  const width = Number(draft.widths[modeId])
  if ('width' in current && Number.isFinite(width) && width > 0) save(modeId, { ...current, width })
  else draft.widths[modeId] = 'width' in current ? String(current.width) : ''
}

function commitCustom(modeId: string) {
  save(modeId, { kind: 'custom', css: draft.custom[modeId] ?? '' })
}

/** The CSS a mode is written under, for developers, under the words designers pick. */
function writtenAs(modeId: string): string {
  return modeConditionCSS(condition(modeId)) ?? modeConditionPlaceholder(collection, modeId) ?? ''
}

/** What a designer needs to know about where the mode applies on the canvas and in code. */
function hint(modeId: string): string {
  const current = condition(modeId)
  if (current.kind === 'manual')
    return variables.value.conditionManualHint({
      attribute: modeAttributeText(collection, modeId)
    })
  if (isAutomaticCondition(current)) return variables.value.conditionAutomaticHint
  return variables.value.conditionHint
}

/** Enter commits the field and hands the keyboard back to the list, so undo reaches the document. */
function done(event: KeyboardEvent) {
  if (event.target instanceof HTMLElement) event.target.blur()
  emit('done')
}

/** An attribute the field refuses keeps the focus, so it can be corrected. */
function attributeDone(event: KeyboardEvent) {
  if (!attributeInvalid.value) done(event)
}
</script>

<template>
  <aside :class="ui.inspector()" data-test-id="collection-inspector">
    <section :class="ui.section()">
      <span :class="ui.label()">{{ variables.collection }}</span>
      <div class="flex items-center gap-1">
        <AppInput
          v-model="draft.name"
          size="sm"
          class="min-w-0 flex-1"
          :aria-label="variables.collection"
          data-test-id="variables-collection-name"
          @change="commitName"
          @enter="done"
        />
        <DropdownMenuRoot>
          <DropdownMenuTrigger as-child>
            <IconButton
              :label="variables.collectionActions"
              data-test-id="variables-collection-menu"
            >
              <icon-lucide-ellipsis class="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent side="bottom" :side-offset="4" align="end" :class="menu.content">
              <DropdownMenuItem
                :class="dangerItem"
                data-test-id="variables-delete-collection"
                @select="emit('remove')"
              >
                <icon-lucide-trash-2 :class="menu.icon" />
                {{ variables.deleteCollection }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
      <label v-if="collection.modes.length > 1" :class="ui.field()">
        <span :class="ui.label()">{{ variables.modeAttribute }}</span>
        <AppInput
          v-model="draft.attribute"
          size="sm"
          :placeholder="defaultModeAttributeName(collection)"
          :state="attributeInvalid ? 'invalid' : 'idle'"
          :aria-invalid="attributeInvalid"
          :aria-describedby="attributeInvalid ? attributeErrorId : undefined"
          :ui="{ input: 'font-mono' }"
          data-test-id="variables-mode-attribute"
          @change="commitAttribute"
          @enter="attributeDone"
        />
        <p v-if="attributeInvalid" :id="attributeErrorId" :class="ui.error()" role="alert">
          {{ variables.modeAttributeInvalid }}
        </p>
        <span v-else-if="attributeExample" :class="ui.hint()">{{
          variables.modeAttributeHint({ example: attributeExample })
        }}</span>
      </label>
    </section>

    <section :class="ui.section()">
      <div class="flex items-center justify-between">
        <h3 :class="ui.sectionTitle()">{{ variables.modes }}</h3>
        <IconButton
          :label="variables.addMode"
          data-test-id="variables-add-mode"
          @click="emit('addMode')"
        >
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </div>
      <div
        v-for="item in collection.modes"
        :key="item.modeId"
        :class="ui.mode()"
        data-test-id="variables-mode"
      >
        <div class="flex items-center gap-1">
          <AppInput
            v-model="draft.modeNames[item.modeId]"
            size="sm"
            class="min-w-0 flex-1"
            :aria-label="variables.renameMode"
            @change="commitModeName(item.modeId)"
            @enter="done"
          />
          <AppBadge v-if="item.modeId === collection.defaultModeId">
            {{ variables.defaultMode }}
          </AppBadge>
          <DropdownMenuRoot>
            <DropdownMenuTrigger as-child>
              <IconButton :label="variables.modeActions({ mode: item.name })">
                <icon-lucide-ellipsis class="size-3.5" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent side="bottom" :side-offset="4" align="end" :class="menu.content">
                <DropdownMenuItem :class="menu.item" @select="emit('duplicateMode', item.modeId)">
                  <icon-lucide-copy :class="menu.icon" />
                  {{ variables.duplicateMode }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="item.modeId !== collection.defaultModeId"
                  :class="menu.item"
                  @select="emit('setDefaultMode', item.modeId)"
                >
                  <icon-lucide-pin :class="menu.icon" />
                  {{ variables.setDefaultMode }}
                </DropdownMenuItem>
                <DropdownMenuSeparator :class="menu.separator" />
                <DropdownMenuItem
                  :class="dangerItem"
                  :disabled="collection.modes.length <= 1"
                  @select="emit('removeMode', item.modeId)"
                >
                  <icon-lucide-trash-2 :class="menu.icon" />
                  {{ variables.deleteMode }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </div>

        <template v-if="item.modeId === collection.defaultModeId">
          <span :class="ui.label()">{{ variables.alwaysOn }}</span>
          <code :class="ui.modeCSS()">:root</code>
        </template>
        <template v-else>
          <span :class="ui.label()">{{ variables.appliesWhen }}</span>
          <AppSelect
            :model-value="condition(item.modeId).kind"
            :options="kindOptions"
            :label="`${item.name}: ${variables.appliesWhen}`"
            :ui="{ trigger: 'w-full' }"
            data-test-id="variables-mode-condition"
            @update:model-value="setKind(item.modeId, $event)"
          />
          <AppInput
            v-if="'width' in condition(item.modeId)"
            v-model="draft.widths[item.modeId]"
            type="number"
            size="sm"
            :aria-label="`${item.name}: ${variables.conditionWidth}`"
            data-test-id="variables-mode-width"
            @change="commitWidth(item.modeId)"
            @enter="done"
          >
            <template #trailing><span :class="ui.hint()">px</span></template>
          </AppInput>
          <AppInput
            v-if="condition(item.modeId).kind === 'custom'"
            v-model="draft.custom[item.modeId]"
            size="sm"
            :aria-label="`${item.name}: ${variables.condition}`"
            :placeholder="modeConditionPlaceholder(collection, item.modeId)"
            :ui="{ input: 'font-mono' }"
            @change="commitCustom(item.modeId)"
            @enter="done"
          />
          <code v-else :class="ui.modeCSS()" data-test-id="variables-mode-css">{{
            writtenAs(item.modeId)
          }}</code>
          <span :class="ui.hint()">{{ hint(item.modeId) }}</span>
        </template>
      </div>
    </section>
  </aside>
</template>
