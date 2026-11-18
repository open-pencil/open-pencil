<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCanvasInput } from '@open-pencil/vue/canvas'
import { useCanvas } from '@open-pencil/vue/canvas/surface'
import { toolCursor } from '@open-pencil/vue/editor/tool-cursor'

import { useEditorStore } from '@/app/editor/active-store'
import PreparationOverlay from '@/components/preparation/canvas/PreparationOverlay.vue'

/**
 * The canvas of a document open read-only: one WebGL canvas with the app's own panning,
 * zooming, and selecting, and its loading overlay. The editor is set read-only, so nothing done
 * here edits the document.
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
    onViewportResize: (width, height) => store.setViewportSize(width, height)
  }
)
const { cursorOverride } = useCanvasInput(
  canvasRef,
  store,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle
)
const cursor = computed(() => toolCursor(store.state.activeTool, cursorOverride.value))
</script>

<template>
  <div class="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-canvas">
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
