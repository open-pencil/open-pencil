<script setup lang="ts">
import { ref } from 'vue'

import { useEditor } from '#vue/editor/context'
import { useCanvas, type UseCanvasOptions } from '#vue/canvas/surface/use'
import { provideCanvas } from '#vue/canvas/context'

const { showRulers, preserveDrawingBuffer } = defineProps<UseCanvasOptions>()

const editor = useEditor()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)

const { renderNow, hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = useCanvas(
  canvasRef,
  editor,
  {
    showRulers,
    preserveDrawingBuffer,
    onReady: () => {
      ready.value = true
    }
  }
)

provideCanvas({
  canvasRef,
  ready,
  renderNow,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle
})
</script>

<template>
  <slot :canvas-ref="canvasRef" :ready="ready" :render-now="renderNow" />
</template>
