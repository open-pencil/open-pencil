<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, nextTick, useTemplateRef, type ComponentPublicInstance } from 'vue'

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
import { toolbarEntryIcons, useToolbarEntryLabels } from '@/components/toolbar/labels'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppShortcutText from '@/components/ui/menu/AppShortcutText.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import theme from '@/theme/settings/toolbar'

/**
 * Lists every toolbar entry with its visibility, order and flyout. Entries in one box share a
 * flyout: a row dropped inside a box joins it, between boxes becomes a button, and onto another
 * row shares that row's flyout. The grip moves a row with the arrow keys and the link button
 * joins or leaves the box above, so all of it works without a pointer.
 */
const layout = defineModel<ToolbarLayout>({ required: true })
const { settings } = useI18n()
const labels = useToolbarEntryLabels()
const toolbar = tv(theme)
const list = useTemplateRef<HTMLElement>('list')

const rows = computed(() => toolbarRows(layout.value))
const groups = computed(() => {
  const boxes: ToolbarRow[][] = []
  for (const row of rows.value) {
    const last = boxes.at(-1)
    if (row.joined && last) last.push(row)
    else boxes.push([row])
  }
  return boxes
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

function setupRow(element: Element | ComponentPublicInstance | null, entry: ToolbarEntry) {
  drag.setupItem(element instanceof HTMLElement ? element : null, () => ({ id: entry }))
}

/** The drop line for a row: on its box's divider, or in the gap when it is at the box's edge. */
function lineEdge(box: ToolbarRow[], index: number) {
  const before = drag.instruction.value?.operation === 'reorder-before'
  const atEdge = before ? index === 0 : index === box.length - 1
  return `${atEdge ? 'between' : 'inside'}-${before ? 'top' : 'bottom'}` as const
}

function dropShown(entry: ToolbarEntry) {
  return drag.instructionTargetId.value === entry ? drag.instruction.value?.operation : undefined
}

function shortcut(entry: ToolbarEntry) {
  return isToolbarAction(entry) ? '' : TOOL_SHORTCUT_LABELS[entry]
}

/** Rows move between boxes as they are edited, so focus follows the control that was used. */
async function refocus(entry: ToolbarEntry, control: string) {
  await nextTick()
  list.value
    ?.querySelector<HTMLButtonElement>(`[data-entry="${entry}"] [data-control="${control}"]`)
    ?.focus()
}

const ARROW_STEPS: Partial<Record<string, -1 | 1>> = { ArrowUp: -1, ArrowDown: 1 }

function onGripKey(event: KeyboardEvent, row: ToolbarRow) {
  const step = ARROW_STEPS[event.key]
  if (!step || !(step < 0 ? row.canMoveUp : row.canMoveDown)) return
  event.preventDefault()
  layout.value = moveToolbarEntry(layout.value, row.entry, step)
  void refocus(row.entry, 'grip')
}

function toggleGroup(row: ToolbarRow) {
  layout.value = row.joined
    ? splitToolbarEntry(layout.value, row.entry)
    : joinToolbarEntry(layout.value, row.entry)
  void refocus(row.entry, 'group')
}

function setShown(entry: ToolbarEntry, shown: boolean) {
  layout.value = setToolbarEntryHidden(layout.value, entry, !shown)
}
</script>

<template>
  <ol ref="list" :class="toolbar().root()" data-test-id="toolbar-layout">
    <li v-for="box in groups" :key="box[0]?.entry">
      <ol :class="toolbar().group()">
        <li
          v-for="(row, index) in box"
          :key="row.entry"
          :ref="(element) => setupRow(element, row.entry)"
          :class="toolbar().row()"
          :data-entry="row.entry"
          :data-hidden="row.hidden || undefined"
          :data-dragging="drag.draggingId.value === row.entry || undefined"
        >
          <span v-if="dropShown(row.entry) === 'combine'" :class="toolbar().target()" />
          <span
            v-else-if="dropShown(row.entry)"
            :class="toolbar({ edge: lineEdge(box, index) }).line()"
          />
          <IconButton
            data-control="grip"
            :class="toolbar().grip()"
            :label="settings.toolbarReorder({ tool: labels[row.entry] })"
            aria-keyshortcuts="ArrowUp ArrowDown"
            @keydown="onGripKey($event, row)"
          >
            <icon-lucide-grip-vertical class="size-3.5" />
          </IconButton>
          <IconButton
            v-if="row.joined || row.canJoin"
            data-control="group"
            toggle
            :class="toolbar().link()"
            :active="row.joined"
            :label="settings.toolbarGroup({ tool: labels[row.entry] })"
            @click="toggleGroup(row)"
          >
            <icon-lucide-link-2 class="size-3.5" />
          </IconButton>
          <span v-else :class="toolbar().spacer()" aria-hidden="true" />
          <component
            :is="toolbarEntryIcons[row.entry]"
            :class="toolbar({ hidden: row.hidden }).icon()"
            aria-hidden="true"
          />
          <span :class="toolbar({ hidden: row.hidden }).label()">{{ labels[row.entry] }}</span>
          <AppShortcutText :ui="{ base: toolbar().shortcut() }">
            {{ shortcut(row.entry) }}
          </AppShortcutText>
          <AppSwitch
            :model-value="!row.hidden"
            :disabled="row.entry === PINNED_TOOLBAR_ENTRY"
            :label="settings.toolbarShow({ tool: labels[row.entry] })"
            @update:model-value="setShown(row.entry, $event)"
          />
        </li>
      </ol>
    </li>
  </ol>
</template>
