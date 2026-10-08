<script setup lang="ts">
import { createEditor } from '@open-pencil/core/editor'
import { parseColor } from '@open-pencil/scene-graph/color'

import CanvasRoot from '#vue/canvas/CanvasRoot.vue'
import CanvasSurface from '#vue/canvas/CanvasSurface.vue'
import { provideEditor } from '#vue/editor/context'

const editor = createEditor()
editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
  name: 'Card',
  x: 220,
  y: 150,
  width: 160,
  height: 100,
  fills: [{ type: 'SOLID', color: parseColor('#338cf2'), opacity: 1, visible: true }]
})
provideEditor(editor)
</script>

<template>
  <CanvasRoot v-slot="{ ready }" :show-rulers="false">
    <CanvasSurface class="block h-[400px] w-[600px]" :data-ready="ready || undefined" />
  </CanvasRoot>
</template>
