<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, nextTick, useTemplateRef } from 'vue'

import { useI18n } from '@open-pencil/vue'

import {
  isToolbarAction,
  joinToolbarEntry,
  moveToolbarEntry,
  PINNED_TOOLBAR_ENTRY,
  setToolbarEntryHidden,
  splitToolbarEntry,
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
 * flyout; the link button on a row puts it in the box above or takes it out.
 */
const layout = defineModel<ToolbarLayout>({ required: true })
const { settings } = useI18n()
const labels = useToolbarEntryLabels()
const toolbar = tv(theme)
const list = useTemplateRef<HTMLElement>('list')

const groups = computed(() => {
  const boxes: ToolbarRow[][] = []
  for (const row of toolbarRows(layout.value)) {
    const last = boxes.at(-1)
    if (row.joined && last) last.push(row)
    else boxes.push([row])
  }
  return boxes
})

function shortcut(entry: ToolbarEntry) {
  return isToolbarAction(entry) ? '' : TOOL_SHORTCUT_LABELS[entry]
}

/** Rows move between boxes as they are edited, so focus follows the control that was used. */
async function refocus(entry: ToolbarEntry, control: string, fallback?: string) {
  await nextTick()
  const row = list.value?.querySelector(`[data-entry="${entry}"]`)
  for (const name of [control, fallback]) {
    const button = name && row?.querySelector<HTMLButtonElement>(`[data-control="${name}"]`)
    if (button && !button.disabled) return button.focus()
  }
}

function move(row: ToolbarRow, step: -1 | 1) {
  layout.value = moveToolbarEntry(layout.value, row.entry, step)
  void refocus(row.entry, step < 0 ? 'up' : 'down', step < 0 ? 'down' : 'up')
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
    <li v-for="group in groups" :key="group[0]?.entry">
      <ol :class="toolbar().group()">
        <li
          v-for="row in group"
          :key="row.entry"
          :class="toolbar().row()"
          :data-entry="row.entry"
          :data-hidden="row.hidden || undefined"
        >
          <IconButton
            v-if="row.joined || row.canJoin"
            data-control="group"
            toggle
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
          <span :class="toolbar().controls()">
            <IconButton
              data-control="up"
              :disabled="!row.canMoveUp"
              :label="settings.toolbarMoveUp({ tool: labels[row.entry] })"
              @click="move(row, -1)"
            >
              <icon-lucide-chevron-up class="size-3.5" />
            </IconButton>
            <IconButton
              data-control="down"
              :disabled="!row.canMoveDown"
              :label="settings.toolbarMoveDown({ tool: labels[row.entry] })"
              @click="move(row, 1)"
            >
              <icon-lucide-chevron-down class="size-3.5" />
            </IconButton>
            <AppSwitch
              :model-value="!row.hidden"
              :disabled="row.entry === PINNED_TOOLBAR_ENTRY"
              :label="settings.toolbarShow({ tool: labels[row.entry] })"
              @update:model-value="setShown(row.entry, $event)"
            />
          </span>
        </li>
      </ol>
    </li>
  </ol>
</template>
