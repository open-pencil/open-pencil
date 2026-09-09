<script setup lang="ts">
const { adjacent = false } = defineProps<{ adjacent?: boolean }>()
import type { LayerNode } from '@open-pencil/vue'

import LayerTreeNodeRow from '../LayerTreeNodeRow.vue'
import LayerTreeRenameRow from '../LayerTreeRenameRow.vue'
import type { LayerRenameControls, LayerTreeChrome, LayerTreeItemActions } from '../types'
import { provideLayerTreeUI } from '../ui'

provideLayerTreeUI(() => undefined)

function noop() {
  return undefined
}

const actions: LayerTreeItemActions = {
  select: noop,
  toggleExpand: noop,
  toggleVisibility: noop,
  toggleLock: noop,
  rename: noop
}
const renameControls: LayerRenameControls = {
  commit: noop,
  onKeydown: noop,
  focusInput: async (input) => {
    input.focus()
  }
}

function node(id: string, overrides: Partial<LayerNode> = {}): LayerNode {
  return {
    id,
    name: id,
    type: 'RECTANGLE',
    layoutMode: 'NONE',
    visible: true,
    locked: false,
    ...overrides
  }
}

function chrome(overrides: Partial<LayerTreeChrome> = {}): LayerTreeChrome {
  return {
    draggingId: null,
    instruction: null,
    instructionTargetId: null,
    focused: false,
    indent: 16,
    ...overrides
  }
}

const states = [
  { label: 'Normal', node: node('Normal'), selected: false, chrome: chrome() },
  {
    label: 'Selected focused',
    node: node('Selected focused'),
    selected: true,
    chrome: chrome({ focused: true })
  },
  { label: 'Hover neighbor', node: node('Hover neighbor'), selected: false, chrome: chrome() },
  {
    label: 'Selected unfocused',
    node: node('Selected unfocused'),
    selected: true,
    chrome: chrome()
  },
  { label: 'Hidden', node: node('Hidden', { visible: false }), selected: false, chrome: chrome() },
  { label: 'Locked', node: node('Locked', { locked: true }), selected: false, chrome: chrome() },
  {
    label: 'Component',
    node: node('Component', { type: 'COMPONENT' }),
    selected: false,
    chrome: chrome()
  },
  {
    label: 'Dragging',
    node: node('Dragging'),
    selected: false,
    chrome: chrome({ draggingId: 'Dragging' })
  },
  {
    label: 'Child drop',
    node: node('Child drop'),
    selected: false,
    chrome: chrome({
      instruction: { type: 'make-child' },
      instructionTargetId: 'Child drop'
    })
  },
  {
    label: 'Drop above',
    node: node('Drop above'),
    selected: false,
    chrome: chrome({
      instruction: { type: 'reorder-above' },
      instructionTargetId: 'Drop above'
    })
  },
  {
    label: 'Drop below',
    node: node('Drop below'),
    selected: false,
    chrome: chrome({
      instruction: { type: 'reorder-below' },
      instructionTargetId: 'Drop below'
    })
  }
]
</script>

<template>
  <div class="w-72 rounded-lg border border-border bg-panel p-2 shadow-lg">
    <div class="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
      Layer Tree states
    </div>
    <div :class="adjacent ? 'space-y-0' : 'space-y-1'">
      <div v-for="state in states" :key="state.label" :aria-label="state.label">
        <LayerTreeNodeRow
          :node="state.node"
          :level="1"
          has-children
          :selected="state.selected"
          pad-left="8px"
          :expanded="state.label === 'Normal'"
          :actions="actions"
          :chrome="state.chrome"
        />
      </div>
      <div aria-label="Rename">
        <LayerTreeRenameRow
          :node="node('Rename')"
          :has-children="false"
          pad-left="8px"
          :expanded="false"
          :actions="actions"
          :rename-controls="renameControls"
        />
      </div>
    </div>
  </div>
</template>
