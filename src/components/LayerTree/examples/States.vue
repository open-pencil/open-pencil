<script setup lang="ts">
import type { NodeType, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'
import type { LayerNode, LayerOutline } from '@open-pencil/vue/primitives/LayerTree'

import type { LayerIssueMark } from '@/app/editor/design-check/layers'
import LayerTreeNodeRow from '@/components/LayerTree/LayerTreeNodeRow.vue'
import LayerTreeRenameRow from '@/components/LayerTree/LayerTreeRenameRow.vue'
import type {
  LayerRenameControls,
  LayerTreeChrome,
  LayerTreeItemActions
} from '@/components/LayerTree/types'
import { provideLayerTreeUI } from '@/components/LayerTree/ui'

const { adjacent = false } = defineProps<{ adjacent?: boolean }>()

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

const STRAIGHT = { tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }

/** A closed triangle and an open curve, which vector rows draw as their icons. */
const triangleNetwork: VectorNetwork = {
  vertices: [
    { x: 0, y: 100 },
    { x: 50, y: 0 },
    { x: 100, y: 100 }
  ],
  segments: [
    { start: 0, end: 1, ...STRAIGHT },
    { start: 1, end: 2, ...STRAIGHT },
    { start: 2, end: 0, ...STRAIGHT }
  ],
  regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
}
const curveNetwork: VectorNetwork = {
  vertices: [
    { x: 0, y: 75 },
    { x: 100, y: 75 }
  ],
  segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: -100 }, tangentEnd: { x: 0, y: -100 } }],
  regions: []
}
/** A shape layer's outline, which its row draws as its icon. */
function outline(type: NodeType, overrides: Partial<SceneNode> = {}): LayerOutline {
  return createDefaultNode(() => type, type, { width: 100, height: 100, ...overrides })
}
const triangle = outline('VECTOR', { vectorNetwork: triangleNetwork })
const curve = outline('VECTOR', { vectorNetwork: curveNetwork, height: 75 })

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

const states: Array<{
  label: string
  node: LayerNode
  selected: boolean
  chrome: LayerTreeChrome
  issue?: LayerIssueMark
}> = [
  { label: 'Normal', node: node('Normal'), selected: false, chrome: chrome() },
  {
    label: 'Own error',
    node: node('Own error'),
    selected: false,
    chrome: chrome(),
    issue: { severity: 'error', count: 2, own: true }
  },
  {
    label: 'Selected own warning',
    node: node('Selected own warning'),
    selected: true,
    chrome: chrome({ focused: true }),
    issue: { severity: 'warning', count: 1, own: true }
  },
  {
    label: 'Contains error',
    node: node('Contains error'),
    selected: false,
    chrome: chrome(),
    issue: { severity: 'error', count: 0, own: false }
  },
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
  {
    label: 'Selected hidden',
    node: node('Selected hidden', { visible: false }),
    selected: true,
    chrome: chrome({ focused: true })
  },
  { label: 'Locked', node: node('Locked', { locked: true }), selected: false, chrome: chrome() },
  {
    label: 'Slot',
    node: node('Slot', { type: 'FRAME', layoutMode: 'VERTICAL', slot: true }),
    selected: false,
    chrome: chrome()
  },
  {
    label: 'Component',
    node: node('Component', { type: 'COMPONENT' }),
    selected: false,
    chrome: chrome()
  },
  {
    label: 'Vector',
    node: node('Vector', { type: 'VECTOR', outline: triangle }),
    selected: false,
    chrome: chrome()
  },
  {
    label: 'Selected vector',
    node: node('Selected vector', { type: 'VECTOR', outline: curve }),
    selected: true,
    chrome: chrome({ focused: true })
  },
  {
    label: 'Hidden vector',
    node: node('Hidden vector', { type: 'VECTOR', outline: triangle, visible: false }),
    selected: false,
    chrome: chrome()
  },
  {
    label: 'Turned vector',
    node: node('Turned vector', { type: 'VECTOR', outline: { ...triangle, rotation: -45 } }),
    selected: false,
    chrome: chrome()
  },
  {
    label: 'Rounded rectangle',
    node: node('Rounded rectangle', {
      outline: outline('RECTANGLE', { width: 200, height: 100, cornerRadius: 24 })
    }),
    selected: false,
    chrome: chrome()
  },
  {
    label: 'Ellipse',
    node: node('Ellipse', { type: 'ELLIPSE', outline: outline('ELLIPSE', { height: 60 }) }),
    selected: false,
    chrome: chrome()
  },
  {
    label: 'Star',
    node: node('Star', { type: 'STAR', outline: outline('STAR', { pointCount: 5 }) }),
    selected: false,
    chrome: chrome()
  },
  {
    label: 'Image',
    node: node('Image', { outline: outline('RECTANGLE'), image: true }),
    selected: false,
    chrome: chrome()
  },
  {
    label: 'Mask',
    node: node('Mask', { type: 'ELLIPSE', outline: outline('ELLIPSE'), mask: true }),
    selected: false,
    chrome: chrome()
  },
  {
    label: 'Turned line',
    node: node('Turned line', {
      type: 'LINE',
      outline: outline('LINE', { height: 0, rotation: -30 })
    }),
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
      <div v-for="state in states" :key="state.label">
        <LayerTreeNodeRow
          :node="state.node"
          :level="1"
          has-children
          :selected="state.selected"
          pad-left="8px"
          :expanded="state.label === 'Normal'"
          :actions="actions"
          :chrome="state.chrome"
          :issue="state.issue"
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
