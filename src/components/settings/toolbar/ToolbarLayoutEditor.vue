<script setup lang="ts">
import { computed, ref, type ComponentPublicInstance } from 'vue'

import { useFlatReorderDrag } from '@open-pencil/vue'

import {
  combineToolbarEntry,
  detachToolbarEntry,
  isToolbarAction,
  isToolbarEntry,
  joinToolbarEntry,
  moveToolbarEntry,
  PINNED_TOOLBAR_ENTRY,
  placeToolbarEntry,
  setToolbarEntryHidden,
  toolbarDropOperations,
  toolbarRows,
  type ToolbarEntry,
  type ToolbarLayout,
  type ToolbarRow
} from '@/app/editor/toolbar/layout'
import { TOOL_SHORTCUT_LABELS } from '@/app/editor/toolbar/shortcuts'
import ToolbarLayoutJoint from '@/components/settings/toolbar/ToolbarLayoutJoint.vue'
import ToolbarLayoutRow, {
  type ToolbarRowControl
} from '@/components/settings/toolbar/ToolbarLayoutRow.vue'
import { toolbarEntryIcons, useToolbarEntryLabels } from '@/components/toolbar/labels'

/**
 * Lists every toolbar entry with its visibility, order and flyout, one box per flyout. A dragged
 * row lands on a joint: inside a box it joins that flyout, between boxes it becomes a button.
 * Dropped onto another row, the two share a flyout. Each row's grip and options do the same from
 * the keyboard.
 */
const layout = defineModel<ToolbarLayout>({ required: true })
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

/** Editing can move a row to another box, so the control used takes focus where it lands. */
const focusRequest = ref<{ entry: ToolbarEntry; control: ToolbarRowControl } | null>(null)

function focusFor(entry: ToolbarEntry) {
  return focusRequest.value?.entry === entry ? focusRequest.value.control : null
}

function edit(
  entry: ToolbarEntry,
  control: ToolbarRowControl,
  change: (current: ToolbarLayout) => ToolbarLayout
) {
  layout.value = change(layout.value)
  focusRequest.value = { entry, control }
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
        :dropping="dropJoint === box.head.index"
      />
      <div class="flex flex-col rounded border border-border">
        <template v-for="{ row, index } in box.rows" :key="row.entry">
          <ToolbarLayoutJoint v-if="row.joined" kind="inside" :dropping="dropJoint === index" />
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
              :group-with="row.canJoin && row.above ? labels[row.above] : undefined"
              :in-flyout="row.inFlyout"
              :drop-target="isCombineTarget(row.entry)"
              :focus="focusFor(row.entry)"
              @move="
                (step, control) =>
                  edit(row.entry, control, (current) => moveToolbarEntry(current, row.entry, step))
              "
              @group="edit(row.entry, 'options', (current) => joinToolbarEntry(current, row.entry))"
              @ungroup="
                edit(row.entry, 'options', (current) => detachToolbarEntry(current, row.entry))
              "
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
