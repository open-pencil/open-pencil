<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { useCanvas } from '@/composables/use-canvas'
import { useCanvasInput } from '@/composables/use-canvas-input'
import { useCollabInjected } from '@/composables/use-collab'
import { useTextEdit } from '@/composables/use-text-edit'
import { useEditorStore } from '@/stores/editor'
import CanvasContextMenu from './CanvasContextMenu.vue'

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
      <Transition leave-active-class="transition-opacity duration-300" leave-to-class="opacity-0">
        <div
          v-if="store.state.loading"
          class="absolute inset-0 z-50 flex items-center justify-center bg-canvas"
        >
          <svg
            class="size-8 text-white opacity-40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="m15.232 5.232 3.536 3.536m-2.036-5.036a2.5 2.5 0 0 1 3.536 3.536L6.5 21.036H3v-3.572L16.732 3.732Z"
            />
          </svg>
          <div
            class="absolute bottom-1/2 left-1/2 h-0.5 w-25 -translate-x-1/2 translate-y-10 overflow-hidden rounded-full bg-white/8"
          >
            <div
              class="h-full w-2/5 animate-[slide_1s_ease-in-out_infinite] rounded-full bg-white/25"
            />
          </div>
        </div>
      </Transition>
    </div>
  </CanvasContextMenu>
</template>
