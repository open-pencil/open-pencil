<script setup lang="ts">
import { ref } from 'vue'

import CommandPaletteRoot from './CommandPaletteRoot.vue'
import type { CommandPaletteGroup } from './types'

const selected = ref('')
const selectedLabels = ref<string[]>([])
const labels = {
  searchPlaceholder: 'Search commands…',
  searchLabel: 'Search commands',
  paletteLabel: 'Command palette',
  empty: 'No commands found.',
  back: 'Back'
}
const groups: CommandPaletteGroup[] = [
  {
    id: 'file',
    label: 'File',
    items: [
      { id: 'new', label: 'New document', shortcut: { keys: ['⌘', 'N'] } },
      { id: 'settings', label: 'Settings', shortcut: { keys: ['⌘', ','] } },
      {
        id: 'export',
        label: 'Export selection',
        children: [
          { id: 'export-png', label: 'Export selection as PNG' },
          { id: 'export-svg', label: 'Export selection as SVG' }
        ]
      }
    ]
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [{ id: 'undo', label: 'Undo', shortcut: { keys: ['⌘', 'Z'] } }]
  }
]
</script>

<template>
  <div class="space-y-2">
    <CommandPaletteRoot
      v-model="selected"
      :groups="groups"
      :labels="labels"
      :ui="{
        root: 'w-[min(40rem,100%)] overflow-hidden rounded-xl border border-border bg-panel text-surface shadow-xl',
        search: 'h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none',
        content: 'max-h-96 overflow-y-auto p-2',
        label: 'px-2 py-1 text-[11px] text-muted',
        item: 'flex h-8 cursor-pointer items-center gap-2 rounded-md p-1 text-[13px] data-[highlighted]:bg-hover',
        itemIcon: 'flex size-6 shrink-0 items-center justify-center text-muted',
        itemLabel: 'min-w-0 flex-1 truncate',
        shortcut: 'flex items-center gap-1 text-xs text-muted',
        key: 'rounded border border-border bg-input px-1.5 py-1 font-mono leading-none'
      }"
      @select="selectedLabels.push($event.label)"
    />
    <div v-if="selectedLabels.length" role="status" aria-label="Last selection">
      {{ selectedLabels.at(-1) }}
    </div>
  </div>
</template>
