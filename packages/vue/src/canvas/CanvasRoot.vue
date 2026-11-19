<script setup lang="ts">
import { computed, ref } from 'vue'

import { provideCanvas } from '#vue/canvas/context'
import { useCanvas } from '#vue/canvas/surface/use'
import { useTextEdit } from '#vue/canvas/text-edit/use'
import { useCanvasInput } from '#vue/canvas/useCanvasInput'
import { useEditor } from '#vue/editor/context'
import { toolCursor } from '#vue/editor/tool-cursor'

const {
  showRulers,
  preserveDrawingBuffer,
  input = true
} = defineProps<{
  showRulers?: boolean
  preserveDrawingBuffer?: boolean
  /**
   * Whether the canvas takes pointer input and text typing: selecting, dragging, drawing with the
   * active tool, panning and zooming, editing paths and text. Off, it only draws.
   */
  input?: boolean
}>()

const emit = defineEmits<{
  /** The surface is ready and the document is drawing. */
  ready: []
  /** The surface could not start, as when CanvasKit fails to load. */
  failed: [error: unknown]
}>()

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
      emit('ready')
    },
    onFailed: (error) => emit('failed', error)
  }
)

const cursorOverride = input
  ? useCanvasInput(canvasRef, editor, hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle)
      .cursorOverride
  : null
if (input) useTextEdit(canvasRef, editor)

provideCanvas({
  canvasRef,
  ready,
  renderNow,
  cursor: computed(() =>
    cursorOverride ? toolCursor(editor.state.activeTool, cursorOverride.value) : undefined
  ),
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle
})
</script>

<template>
  <slot :canvas-ref="canvasRef" :ready="ready" :render-now="renderNow" />
</template>
