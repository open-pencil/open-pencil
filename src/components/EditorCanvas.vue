<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { useCanvas } from '@/composables/use-canvas'
import { useCanvasInput } from '@/composables/use-canvas-input'
import { useCollabInjected } from '@/composables/use-collab'
import { useTextEdit } from '@/composables/use-text-edit'
import { useEditorStore } from '@/stores/editor'
import CanvasContextMenu from './CanvasContextMenu.vue'
import CanvasControls from './CanvasControls.vue'

const store = useEditorStore()
const collab = useCollabInjected()
const canvasRef = ref<HTMLCanvasElement | null>(null)

const { hitTestSectionTitle, hitTestComponentLabel } = useCanvas(canvasRef, store)
const { cursorOverride } = useCanvasInput(
  canvasRef,
  store,
  hitTestSectionTitle,
  hitTestComponentLabel,
  (cx, cy) => collab?.updateCursor(cx, cy, store.state.currentPageId)
)

useTextEdit(canvasRef, store)

watch(
  () => [...store.state.selectedIds],
  (ids) => collab?.updateSelection(ids)
)

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
      <canvas ref="canvasRef" :style="{ cursor }" class="block size-full touch-none" />
      <!-- Bottom-left controls -->
      <div class="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2">
        <CanvasControls />
      </div>
    </div>
  </CanvasContextMenu>
</template>
