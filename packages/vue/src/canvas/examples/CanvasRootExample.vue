<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

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
const title = editor.graph.createNode('TEXT', editor.state.currentPageId, {
  name: 'Title',
  x: 220,
  y: 60,
  width: 160,
  height: 24,
  text: 'Hello',
  fontSize: 18
})
provideEditor(editor)

const started = ref(false)

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
const titleText = computed(() => {
  void editor.state.sceneVersion
  return editor.graph.getNode(title.id)?.text ?? ''
})
</script>

<template>
  <CanvasRoot v-slot="{ ready }" :show-rulers="false" :input="input" @ready="started = true">
    <CanvasSurface class="block h-100 w-150" :data-ready="ready || undefined" />
  </CanvasRoot>
  <p class="mt-2 text-xs" data-test-id="selection">{{ selection || 'Nothing selected' }}</p>
  <p class="text-xs" data-test-id="card">Card at {{ cardAt }}</p>
  <p class="text-xs" data-test-id="title">Title reads {{ titleText }}</p>
  <p class="text-xs" data-test-id="status">{{ started ? 'Started' : 'Starting' }}</p>
</template>
