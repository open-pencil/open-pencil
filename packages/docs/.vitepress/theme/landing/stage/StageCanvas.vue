<script setup lang="ts">
import { computed, ref } from 'vue'

import { toolCursor, useCanvas, useCanvasInput, useTextEdit } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import PreparationOverlay from '@/components/preparation/canvas/Overlay.vue'

/**
 * One WebGL canvas per stage. The app's `EditorCanvas` splits the scene and its overlays
 * across two contexts, which is right for a full-window editor but would put a page of
 * stages past the browser's context limit. This is the SDK's single-canvas path with the
 * same input handling and the app's loading overlay.
 */
const store = useEditorStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)

const shouldSuspendRender = () =>
  store.state.preparation !== null &&
  store.state.preparation.kind !== 'font-retry' &&
  store.state.preparation.phase !== 'preparing-render'

const { hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = useCanvas(
  canvasRef,
  store,
  {
    showRulers: false,
    shouldSuspendRender,
    onReady: store.markCanvasReady,
    onViewportResize: (width, height) => store.setViewportSize(width, height),
    onPresented: ({ sceneVersion }) =>
      store.preparationController.acknowledgePresentation(sceneVersion)
  }
)

const { cursorOverride } = useCanvasInput(
  canvasRef,
  store,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle
)
useTextEdit(canvasRef, store)

const cursor = computed(() => toolCursor(store.state.activeTool, cursorOverride.value))
</script>

<template>
  <div class="relative min-h-0 min-w-0 flex-1 overflow-hidden">
    <canvas
      ref="canvasRef"
      tabindex="-1"
      :style="{ cursor }"
      class="absolute inset-0 block size-full touch-none outline-none"
    />
    <PreparationOverlay
      v-if="store.state.preparation && store.state.preparation.kind !== 'font-retry'"
      :preparation="store.state.preparation"
    />
  </div>
</template>
