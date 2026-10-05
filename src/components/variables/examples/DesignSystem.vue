<script setup lang="ts">
import { shallowReactive } from 'vue'

import { createDefaultEditorState, createEditor } from '@open-pencil/core/editor'
import { SceneGraph, type Variable, type VariableValue } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { provideEditor } from '@open-pencil/vue'

import TokensPanel from '@/components/variables/TokensPanel.vue'

/** The frame width in pixels, capped by the window; the panel lays out by this. */
const { width = 1040 } = defineProps<{ width?: number }>()

/** Reactive state, as the app session gives it, so edits re-render the panel. */
const graph = new SceneGraph()
const editor = createEditor({
  graph,
  state: shallowReactive(createDefaultEditorState(graph.getPages()[0].id))
})

function addVariable(
  collectionId: string,
  id: string,
  name: string,
  type: Variable['type'],
  valuesByMode: Record<string, VariableValue>,
  extra: Partial<Variable> = {}
) {
  graph.addVariable({
    id,
    name,
    type,
    collectionId,
    valuesByMode,
    description: '',
    hiddenFromPublishing: false,
    ...extra
  })
}

graph.addCollection({
  id: 'theme',
  name: 'Theme',
  modes: [
    { modeId: 'light', name: 'Light' },
    { modeId: 'dark', name: 'Dark' },
    { modeId: 'contrast', name: 'Contrast', condition: '@media (prefers-contrast: more)' }
  ],
  defaultModeId: 'light',
  variableIds: []
})
graph.addCollection({
  id: 'primitives',
  name: 'Primitives',
  modes: [{ modeId: 'base', name: 'Base' }],
  defaultModeId: 'base',
  variableIds: []
})
graph.addCollection({
  id: 'space',
  name: 'Space',
  modes: [
    { modeId: 'comfortable', name: 'Comfortable' },
    { modeId: 'compact', name: 'Compact', condition: '@media (max-width: 640px)' }
  ],
  defaultModeId: 'comfortable',
  variableIds: []
})

for (const [id, name, hex] of [
  ['blue-300', 'Blue/300', '#94C4FC'],
  ['blue-500', 'Blue/500', '#3B82F5'],
  ['blue-700', 'Blue/700', '#1D4ED8'],
  ['gray-50', 'Gray/50', '#F9FAFB'],
  ['gray-900', 'Gray/900', '#111827']
] as const) {
  addVariable('primitives', id, name, 'COLOR', { base: parseColor(hex) })
}

addVariable(
  'theme',
  'primary',
  'Brand/Primary',
  'COLOR',
  {
    light: { aliasId: 'blue-500' },
    dark: { aliasId: 'blue-300' },
    contrast: { aliasId: 'blue-700' }
  },
  { scopes: ['ALL_FILLS'], description: 'Buttons, links, and focus rings.' }
)
addVariable('theme', 'surface', 'Surface/Base', 'COLOR', {
  light: parseColor('#FFFFFF'),
  dark: parseColor('#111827'),
  contrast: parseColor('#FFFFFF')
})
addVariable('theme', 'ink', 'Surface/Ink', 'COLOR', {
  light: { aliasId: 'gray-900' },
  dark: { aliasId: 'gray-50' },
  contrast: parseColor('#000000')
})

addVariable(
  'space',
  'gutter',
  'Gutter',
  'FLOAT',
  { comfortable: 24, compact: 16 },
  { unit: 'rem', scopes: ['GAP'] }
)
addVariable(
  'space',
  'page',
  'Page/Inline',
  'FLOAT',
  { comfortable: 32, compact: 16 },
  {
    scopes: ['WIDTH_HEIGHT'],
    expressions: { comfortable: { css: 'clamp(1rem, 4vw, 2rem)', resolved: 32 } }
  }
)
addVariable(
  'space',
  'radius',
  'Radius/Card',
  'FLOAT',
  { comfortable: 12, compact: 8 },
  {
    scopes: ['CORNER_RADIUS']
  }
)
addVariable(
  'space',
  'duration',
  'Motion/Fast',
  'FLOAT',
  { comfortable: 150, compact: 150 },
  {
    unit: 'ms'
  }
)
addVariable(
  'space',
  'font',
  'Font/Sans',
  'STRING',
  { comfortable: 'Inter, system-ui, sans-serif', compact: 'Inter, system-ui, sans-serif' },
  { scopes: ['FONT_FAMILY'] }
)

provideEditor(editor)
</script>

<template>
  <div
    class="flex h-[640px] w-[min(var(--frame-width),calc(100vw-4rem))] flex-col overflow-hidden rounded-lg border border-border bg-panel max-md:h-dvh max-md:w-full max-md:rounded-none max-md:border-0"
    :style="{ '--frame-width': `${width}px` }"
  >
    <TokensPanel />
  </div>
</template>
