<script setup lang="ts">
import { computed, ref, type ComponentPublicInstance } from 'vue'

import { useFlatReorderDrag, useI18n } from '@open-pencil/vue'

import {
  combineToolbarEntry,
  isToolbarAction,
  isToolbarEntry,
  joinToolbarEntry,
  moveToolbarEntry,
  PINNED_TOOLBAR_ENTRY,
  placeToolbarEntry,
  setToolbarEntryHidden,
  splitToolbarEntry,
  toolbarDropOperations,
  toolbarRows,
  type ToolbarEntry,
  type ToolbarLayout,
  type ToolbarRow
} from '@/app/editor/toolbar/layout'
import { TOOL_SHORTCUT_LABELS } from '@/app/editor/toolbar/shortcuts'
import ToolbarLayoutJoint from '@/components/settings/toolbar/ToolbarLayoutJoint.vue'
import ToolbarLayoutRow from '@/components/settings/toolbar/ToolbarLayoutRow.vue'
import { toolbarEntryIcons, useToolbarEntryLabels } from '@/components/toolbar/labels'

/**
 * Lists every toolbar entry with its visibility, order and flyout, one box per flyout. A dragged
 * row lands on a joint: inside a box it joins that flyout, between boxes it becomes a button.
 * Dropped onto another row, the two share a flyout. Grips and link toggles do the same from the
 * keyboard.
 */
const layout = defineModel<ToolbarLayout>({ required: true })
const { settings } = useI18n()
const labels = useToolbarEntryLabels()

/** A row and its place in the whole list, which is also the joint above it. */
interface PlacedRow {
  row: ToolbarRow
  index: number
}

const rows = computed(() => toolbarRows(layout.value))
/** One box per flyout or button; the head is its first row, whose joint sits above the box. */
interface Box {
  head: PlacedRow
  rows: PlacedRow[]
}

const boxes = computed(() => {
  const result: Box[] = []
  for (const [index, row] of rows.value.entries()) {
    const placed = { row, index }
    const last = result.at(-1)
    if (row.joined && last) last.rows.push(placed)
    else result.push({ head: placed, rows: [placed] })
  }
  return result
})

const drag = useFlatReorderDrag({
  items: () => rows.value.map((row) => ({ id: row.entry })),
  operations: (source, target) =>
    isToolbarEntry(source) && isToolbarEntry(target)
      ? toolbarDropOperations(layout.value, source, target)
      : {},
  onMove: (source, index) => {
    if (isToolbarEntry(source)) layout.value = placeToolbarEntry(layout.value, source, index)
  },
  onCombine: (source, target) => {
    if (isToolbarEntry(source) && isToolbarEntry(target))
      layout.value = combineToolbarEntry(layout.value, source, target)
  }
})

/** The joint a dragged row would land on: above the target row, or below it. */
const dropJoint = computed(() => {
  const operation = drag.instruction.value?.operation
  const target = rows.value.findIndex((row) => row.entry === drag.instructionTargetId.value)
  if (target === -1 || !operation || operation === 'combine') return null
  return operation === 'reorder-before' ? target : target + 1
})

function isCombineTarget(entry: ToolbarEntry) {
  return drag.instruction.value?.operation === 'combine' && drag.instructionTargetId.value === entry
}

function setupRow(element: Element | ComponentPublicInstance | null, entry: ToolbarEntry) {
  drag.setupItem(element instanceof HTMLElement ? element : null, () => ({ id: entry }))
}

/** Editing can move a row to another box, so its control takes focus again where it lands. */
const focusRequest = ref<{ entry: ToolbarEntry; control: 'grip' | 'toggle' } | null>(null)

function wantsFocus(entry: ToolbarEntry, control: 'grip' | 'toggle') {
  return focusRequest.value?.entry === entry && focusRequest.value.control === control
}

function move(entry: ToolbarEntry, step: -1 | 1) {
  layout.value = moveToolbarEntry(layout.value, entry, step)
  focusRequest.value = { entry, control: 'grip' }
}

function toggleLink({ entry, joined }: ToolbarRow) {
  layout.value = joined
    ? splitToolbarEntry(layout.value, entry)
    : joinToolbarEntry(layout.value, entry)
  focusRequest.value = { entry, control: 'toggle' }
}

function setShown(entry: ToolbarEntry, shown: boolean) {
  layout.value = setToolbarEntryHidden(layout.value, entry, !shown)
}
</script>

<template>
  <div class="group/list flex flex-col" data-test-id="toolbar-layout">
    <template v-for="(box, boxIndex) in boxes" :key="box.head.row.entry">
      <ToolbarLayoutJoint
        :kind="boxIndex === 0 ? 'end' : 'between'"
        :toggle-label="
          box.head.row.canJoin
            ? settings.toolbarGroup({ tool: labels[box.head.row.entry] })
            : undefined
        "
        :dropping="dropJoint === box.head.index"
        :focus-toggle="wantsFocus(box.head.row.entry, 'toggle')"
        @toggle="toggleLink(box.head.row)"
        @focused="focusRequest = null"
      />
      <div class="flex flex-col rounded border border-border">
        <template v-for="{ row, index } in box.rows" :key="row.entry">
          <ToolbarLayoutJoint
            v-if="row.joined"
            kind="inside"
            linked
            :toggle-label="settings.toolbarGroup({ tool: labels[row.entry] })"
            :dropping="dropJoint === index"
            :focus-toggle="wantsFocus(row.entry, 'toggle')"
            @toggle="toggleLink(row)"
            @focused="focusRequest = null"
          />
          <div
            :ref="(element) => setupRow(element, row.entry)"
            class="data-[dragging]:opacity-40"
            :data-entry="row.entry"
            :data-dragging="drag.draggingId.value === row.entry || undefined"
          >
            <ToolbarLayoutRow
              :label="labels[row.entry]"
              :icon="toolbarEntryIcons[row.entry]"
              :shortcut="isToolbarAction(row.entry) ? '' : TOOL_SHORTCUT_LABELS[row.entry]"
              :hidden="row.hidden"
              :pinned="row.entry === PINNED_TOOLBAR_ENTRY"
              :can-move-up="row.canMoveUp"
              :can-move-down="row.canMoveDown"
              :drop-target="isCombineTarget(row.entry)"
              :focus-grip="wantsFocus(row.entry, 'grip')"
              @move="move(row.entry, $event)"
              @update:shown="setShown(row.entry, $event)"
              @focused="focusRequest = null"
            />
          </div>
        </template>
      </div>
    </template>
    <ToolbarLayoutJoint kind="end" :dropping="dropJoint === rows.length" />
  </div>
</template>
