<script setup lang="ts">
import { ref, computed } from 'vue'

import { useCanvas } from '@/composables/use-canvas'
import { useCanvasInput } from '@/composables/use-canvas-input'
import { useTextEdit } from '@/composables/use-text-edit'
import { useEditorStore } from '@/stores/editor'
import CanvasContextMenu from './CanvasContextMenu.vue'

const store = useEditorStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)

const { hitTestSectionTitle, hitTestComponentLabel } = useCanvas(canvasRef, store)
const { cursorOverride } = useCanvasInput(
  canvasRef,
  store,
  hitTestSectionTitle,
  hitTestComponentLabel
)

useTextEdit(canvasRef, store)

const cursor = computed(() => {
  if (cursorOverride.value) return cursorOverride.value
  const tool = store.state.activeTool
  if (tool === 'HAND') return 'grab'
  if (tool === 'SELECT') return 'default'
  if (tool === 'TEXT') return 'text'
  return 'crosshair'
})
</script>

<template>
  <CanvasContextMenu>
    <div class="canvas-area relative flex-1 min-w-0 min-h-0 overflow-hidden">
      <canvas ref="canvasRef" :style="{ cursor }" class="block size-full" />
    </div>
  </CanvasContextMenu>
</template>
