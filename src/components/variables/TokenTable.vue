<script setup lang="ts">
import { ListboxContent, ListboxGroup, ListboxGroupLabel, ListboxItem, ListboxRoot } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, ref, useTemplateRef, type ComponentPublicInstance } from 'vue'

import type { VariableCollection, VariableValue } from '@open-pencil/scene-graph'
import { useFlatReorderDrag, useI18n } from '@open-pencil/vue'

import {
  parseTokenValueText,
  tokenValueText,
  type TokenGroup,
  type TokenRow
} from '@/app/editor/tokens/model'
import BindingPill from '@/components/ui/binding/BindingPill.vue'
import FillSwatch from '@/components/ui/paint/FillSwatch.vue'
import TokenCellInput from '@/components/variables/TokenCellInput.vue'
import TokenRowMenu from '@/components/variables/TokenRowMenu.vue'
import { VARIABLE_TYPE_ICONS } from '@/components/variables/type-icons'
import { useConditionLabels } from '@/components/variables/useConditionLabels'
import tokensPanelTheme from '@/theme/tokens-panel'

const { collection, groups, labels, modeIds, groupOptions } = defineProps<{
  collection: VariableCollection
  groups: TokenGroup[]
  labels: { name: string; cssName: string; empty: string }
  /** Modes to show values for; every mode by default. */
  modeIds?: readonly string[]
  /** Groups the "Move to group" menu offers. */
  groupOptions: string[]
}>()
/** Click selects one token, Shift extends, and Cmd or Ctrl adds or removes one. */
const selectedIds = defineModel<string[]>('selectedIds', { default: () => [] })
const emit = defineEmits<{
  rename: [id: string, name: string]
  updateValue: [id: string, modeId: string, value: VariableValue]
  duplicate: [ids: string[]]
  moveToGroup: [ids: string[], group: string]
  newGroup: [ids: string[]]
  remove: [ids: string[]]
  reorder: [sourceId: string, targetIndex: number, visibleIds: string[]]
}>()

const { variables } = useI18n()
const ui = tv(tokensPanelTheme)()

const modes = computed(() =>
  modeIds ? collection.modes.filter((mode) => modeIds.includes(mode.modeId)) : collection.modes
)

/** The grid itself follows the panel's container width; only the mode count comes from here. */
const columns = computed(() => ({ '--token-modes': modes.value.length }))

const { summary } = useConditionLabels()

/** When a mode applies, in words, under its name in the column header. */
function condition(modeId: string) {
  return summary(collection, modeId)
}

function modeName(modeId: string) {
  return collection.modes.find((mode) => mode.modeId === modeId)?.name ?? ''
}

function shown<T extends { modeId: string }>(values: readonly T[]) {
  return values.filter((value) => modes.value.some((mode) => mode.modeId === value.modeId))
}

const content = useTemplateRef<ComponentPublicInstance>('content')

/**
 * Takes the keyboard back after a field commits, so arrows, Delete and undo act on the list. The
 * listbox root renders beside a hidden form input, so the focusable element is found from inside.
 */
function focus() {
  const element = content.value?.$el
  const listbox = element instanceof Element ? element.closest('[role="listbox"]') : null
  if (listbox instanceof HTMLElement) listbox.focus({ preventScroll: true })
}
defineExpose({ focus })

const rows = computed(() => groups.flatMap((group) => group.rows))
const visibleIds = computed(() => rows.value.map((row) => row.variable.id))

/** Where a Shift-click range starts: the last token clicked without Shift. */
const anchorId = ref<string | null>(null)

/**
 * Pointer selection the way lists work elsewhere: Cmd or Ctrl adds or removes a token, Shift
 * selects the range from the last click, and a plain click selects just one.
 */
function onSelect(event: CustomEvent<{ originalEvent: Event }>, id: string) {
  const pointer = event.detail.originalEvent
  if (!(pointer instanceof MouseEvent)) return
  if (pointer.metaKey || pointer.ctrlKey) {
    event.preventDefault()
    anchorId.value = id
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter((selected) => selected !== id)
      : [...selectedIds.value, id]
  } else if (pointer.shiftKey && anchorId.value) {
    event.preventDefault()
    const from = visibleIds.value.indexOf(anchorId.value)
    const to = visibleIds.value.indexOf(id)
    if (from === -1 || to === -1) return
    selectedIds.value = visibleIds.value.slice(Math.min(from, to), Math.max(from, to) + 1)
  } else anchorId.value = id
}

/** A cell being edited in place: a token's name, or one mode's number or text value. */
const editing = ref<{ id: string; modeId?: string } | null>(null)

function isEditing(id: string, modeId?: string) {
  return editing.value?.id === id && editing.value.modeId === modeId
}

function startRename(id: string) {
  editing.value = { id }
}

function commitName(row: TokenRow, text: string) {
  editing.value = null
  const label = text.trim()
  if (!label) return
  const path = row.variable.name.slice(0, row.variable.name.length - row.label.length)
  if (path + label !== row.variable.name) emit('rename', row.variable.id, path + label)
}

/** Numbers and text edit in place; colors, booleans and aliases open the inspector instead. */
function editableValue(row: TokenRow, modeId: string) {
  const value = row.variable.valuesByMode[modeId]
  const aliased = typeof value === 'object' && 'aliasId' in value
  return !aliased && (row.variable.type === 'FLOAT' || row.variable.type === 'STRING')
}

function startValueEdit(row: TokenRow, modeId: string) {
  if (editableValue(row, modeId)) editing.value = { id: row.variable.id, modeId }
}

function commitValue(row: TokenRow, modeId: string, text: string) {
  editing.value = null
  const value = parseTokenValueText(row.variable, text)
  if (value !== undefined && value !== row.variable.valuesByMode[modeId])
    emit('updateValue', row.variable.id, modeId, value)
}

/** The row under the pointer joins the selection before its context menu opens. */
function onContextMenu(event: MouseEvent) {
  if (!(event.target instanceof Element)) return
  const id = event.target.closest<HTMLElement>('[data-variable-id]')?.dataset.variableId
  if (id && !selectedIds.value.includes(id)) selectedIds.value = [id]
}

function onKeydown(event: KeyboardEvent) {
  if (editing.value || selectedIds.value.length === 0) return
  if (event.code !== 'Delete' && event.code !== 'Backspace') return
  event.preventDefault()
  emit('remove', [...selectedIds.value])
}

const reorder = useFlatReorderDrag({
  items: () => rows.value.map((row) => ({ id: row.variable.id })),
  onMove: (sourceId, targetIndex) => emit('reorder', sourceId, targetIndex, visibleIds.value)
})

function dragTarget(id: string, element: Element | ComponentPublicInstance | null) {
  const node = element instanceof Element ? element : element?.$el
  reorder.setupItem(node instanceof HTMLElement ? node : null, () => ({ id }))
}

function dropEdge(id: string) {
  if (reorder.instructionTargetId.value !== id) return undefined
  return reorder.instruction.value?.operation === 'reorder-before' ? 'before' : 'after'
}
</script>

<template>
  <ListboxRoot
    v-model="selectedIds"
    multiple
    selection-behavior="replace"
    :class="ui.list()"
    highlight-on-hover
    data-test-id="token-list"
    @keydown="onKeydown"
  >
    <div :class="ui.header()" :style="columns" aria-hidden="true">
      <span>{{ labels.name }}</span>
      <span :class="ui.headerCssColumn()">{{ labels.cssName }}</span>
      <span v-for="mode in modes" :key="mode.modeId" :class="ui.modeHeader()">
        <span class="text-surface">{{ mode.name }}</span>
        <span
          v-if="condition(mode.modeId)"
          :class="ui.modeCondition()"
          :data-code="condition(mode.modeId)?.code || undefined"
        >
          {{ condition(mode.modeId)?.text }}
        </span>
      </span>
    </div>
    <TokenRowMenu
      :groups="groupOptions"
      :single="selectedIds.length === 1"
      @rename="selectedIds[0] && startRename(selectedIds[0])"
      @duplicate="emit('duplicate', [...selectedIds])"
      @move-to-group="emit('moveToGroup', [...selectedIds], $event)"
      @new-group="emit('newGroup', [...selectedIds])"
      @remove="emit('remove', [...selectedIds])"
    >
      <ListboxContent
        ref="content"
        :aria-label="collection.name"
        @contextmenu.capture="onContextMenu"
      >
        <ListboxGroup v-for="group in groups" :key="group.path">
          <ListboxGroupLabel v-if="group.path" :class="ui.group()">{{
            group.path
          }}</ListboxGroupLabel>
          <ListboxItem
            v-for="row in group.rows"
            :key="row.variable.id"
            :ref="(element) => dragTarget(row.variable.id, element)"
            :value="row.variable.id"
            :class="ui.row()"
            :style="columns"
            :data-variable-id="row.variable.id"
            :data-drop="dropEdge(row.variable.id)"
            :data-dragging="reorder.draggingId.value === row.variable.id || undefined"
            data-test-id="variable-row"
            @select="onSelect($event, row.variable.id)"
          >
            <span :class="ui.name()" @dblclick.stop="startRename(row.variable.id)">
              <span :class="ui.nameLine()">
                <component :is="VARIABLE_TYPE_ICONS[row.variable.type]" :class="ui.typeIcon()" />
                <TokenCellInput
                  v-if="isEditing(row.variable.id)"
                  :value="row.label"
                  :label="variables.name"
                  @commit="commitName(row, $event)"
                  @cancel="editing = null"
                />
                <span v-else class="truncate">{{ row.label }}</span>
              </span>
              <span :class="ui.cssStacked()">--{{ row.cssName }}</span>
            </span>
            <span :class="ui.cssColumn()">--{{ row.cssName }}</span>
            <span
              v-for="value in shown(row.values)"
              :key="value.modeId"
              :class="ui.value()"
              @dblclick.stop="startValueEdit(row, value.modeId)"
            >
              <TokenCellInput
                v-if="isEditing(row.variable.id, value.modeId)"
                :value="tokenValueText(row.variable, row.variable.valuesByMode[value.modeId])"
                :label="modeName(value.modeId)"
                @commit="commitValue(row, value.modeId, $event)"
                @cancel="editing = null"
              />
              <template v-else>
                <FillSwatch
                  v-if="value.color"
                  :fill="{
                    type: 'SOLID',
                    visible: true,
                    opacity: value.color.a,
                    color: value.color
                  }"
                  :ui="{ root: 'size-3.5 shrink-0 rounded-sm' }"
                />
                <span v-if="value.expression" :class="ui.expression()">{{ value.expression }}</span>
                <BindingPill v-else-if="value.alias" :label="value.alias" />
                <span v-else class="truncate">{{ value.css }}</span>
              </template>
            </span>
          </ListboxItem>
        </ListboxGroup>
        <p v-if="groups.length === 0" :class="ui.empty()">{{ labels.empty }}</p>
      </ListboxContent>
    </TokenRowMenu>
  </ListboxRoot>
</template>
