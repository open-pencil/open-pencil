<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ContextMenuRoot, ContextMenuTrigger, ContextMenuPortal } from 'reka-ui'

import { toolCursor, useCanvas, useCanvasDrop, useCanvasInput, useTextEdit } from '@open-pencil/vue'
import { useCollabInjected } from '@/composables/use-collab'
import { useEditorStore } from '@/stores/editor'
import CanvasMenu from './CanvasMenu.vue'

const store = useEditorStore()
const collab = useCollabInjected()
const canvasRef = ref<HTMLCanvasElement | null>(null)

const { hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = useCanvas(
  canvasRef,
  store,
  {
    onReady() {
      const loader = document.getElementById('loader')
      if (loader) {
        loader.classList.add('fade-out')
        setTimeout(() => loader.remove(), 300)
      }
    }
  }
)
const { cursorOverride } = useCanvasInput(
  canvasRef,
  store,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
  (cx, cy) => {
    store.state.cursorCanvasX = cx
    store.state.cursorCanvasY = cy
    collab?.updateCursor(cx, cy, store.state.currentPageId)
  }
)

useTextEdit(canvasRef, store)
const { isDraggingOver } = useCanvasDrop(canvasRef, store)

watch(
  () => [...store.state.selectedIds],
  (ids) => collab?.updateSelection(ids)
)

const cursor = computed(() => toolCursor(store.state.activeTool, cursorOverride.value))

function onContextMenu(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const { x: cx, y: cy } = store.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top)
  store.selectAtPoint(cx, cy)
}
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child @contextmenu="onContextMenu">
      <div
        data-test-id="canvas-area"
        class="canvas-area relative min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        <canvas
          ref="canvasRef"
          data-test-id="canvas-element"
          :style="{ cursor }"
          class="block size-full touch-none"
        />
        <Transition
          enter-active-class="transition-opacity duration-150"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-150"
          leave-to-class="opacity-0"
        >
          <div
            v-if="isDraggingOver"
            class="pointer-events-none absolute inset-0 z-40 border-2 border-dashed border-accent/60 bg-accent/5"
          />
        </Transition>
        <Transition leave-active-class="transition-opacity duration-300" leave-to-class="opacity-0">
          <div
            v-if="store.state.loading"
            data-test-id="canvas-loading"
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
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <CanvasMenu />
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
