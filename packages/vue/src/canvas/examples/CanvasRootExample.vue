<script setup lang="ts">
import { computed, reactive } from 'vue'

import { createDefaultEditorState, createEditor } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import CanvasRoot from '#vue/canvas/CanvasRoot.vue'
import CanvasSurface from '#vue/canvas/CanvasSurface.vue'
import { provideEditor } from '#vue/editor/context'

const { input = true } = defineProps<{ input?: boolean }>()

const graph = new SceneGraph()
const page = graph.getPages()[0]
if (!page) throw new Error('Expected an initial page')
// Reactive state, so the selection and the card's place below follow the canvas.
const editor = createEditor({ graph, state: reactive(createDefaultEditorState(page.id)) })
const card = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
  name: 'Card',
  x: 220,
  y: 150,
  width: 160,
  height: 100,
  fills: [{ type: 'SOLID', color: parseColor('#338cf2'), opacity: 1, visible: true }]
})
provideEditor(editor)

const selection = computed(() =>
  editor
    .getSelectedNodes()
    .map((node) => node.name)
    .join(', ')
)
// The graph changes outside Vue; the scene version says when.
const cardAt = computed(() => {
  void editor.state.sceneVersion
  const node = editor.graph.getNode(card.id)
  return node ? `${Math.round(node.x)},${Math.round(node.y)}` : ''
})
</script>

<template>
  <CanvasRoot v-slot="{ ready }" :show-rulers="false" :input="input">
    <CanvasSurface class="block h-100 w-150" :data-ready="ready || undefined" />
  </CanvasRoot>
  <p class="mt-2 text-xs" data-testid="selection">{{ selection || 'Nothing selected' }}</p>
  <p class="text-xs" data-testid="card">Card at {{ cardAt }}</p>
</template>
