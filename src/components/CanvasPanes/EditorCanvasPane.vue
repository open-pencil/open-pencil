<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui'

import { toolCursor, useCanvas, useCanvasDrop, useCanvasInput, useTextEdit } from '@open-pencil/vue'
import { useCollabInjected } from '@/app/collab/use'
import { useEditorStore } from '@/app/editor/active-store'
import { useCanvasCollaborationAwareness } from '@/app/editor/canvas/collaboration-awareness'
import { createCanvasContextSelection } from '@/app/editor/canvas/context-selection'
import { fadeOutGlobalLoader } from '@/app/editor/canvas/loader-overlay'
import CanvasMenu from '@/components/CanvasMenu.vue'

const { paneId } = defineProps<{
  paneId: string
}>()

const store = useEditorStore()
const collab = useCollabInjected()
const sceneCanvasRef = ref<HTMLCanvasElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const isActivePane = computed(() => store.activePaneId.value === paneId)

function activatePane() {
  store.setActivePane(paneId)
}

const { updateCursor } = useCanvasCollaborationAwareness(store, collab)
const { selectAtContextPoint } = createCanvasContextSelection(canvasRef, store)

useCanvas(sceneCanvasRef, store, {
  layer: 'scene',
  showRulers: false,
  getRenderState: () => store.getPaneRenderState(paneId),
  onViewportResize: (width, height) => store.resizePane(paneId, width, height),
  onReady: fadeOutGlobalLoader
})
const { hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = useCanvas(
  canvasRef,
  store,
  {
    layer: 'overlays',
    getRenderState: () => store.getPaneRenderState(paneId),
    onViewportResize: (width, height) => store.resizePane(paneId, width, height)
  }
)
const { cursorOverride, cleanupInteractions } = useCanvasInput(
  canvasRef,
  store,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
  updateCursor,
  activatePane,
  () => store.activePaneId.value === paneId
)

const unregisterCleanup = store.registerPaneCleanup(paneId, cleanupInteractions)
onUnmounted(unregisterCleanup)

useTextEdit(canvasRef, store, { isEnabled: () => store.activePaneId.value === paneId })
const { isDraggingOver } = useCanvasDrop(canvasRef, store, activatePane)

const cursor = computed(() => toolCursor(store.state.activeTool, cursorOverride.value))
const canvasTestId = computed(() =>
  isActivePane.value ? 'canvas-element' : `canvas-element-${paneId}`
)
const sceneCanvasTestId = computed(() =>
  isActivePane.value ? 'scene-canvas-element' : `scene-canvas-element-${paneId}`
)
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child @contextmenu="(activatePane(), selectAtContextPoint($event))">
      <div
        data-test-id="canvas-area"
        :data-pane-id="paneId"
        class="canvas-area relative min-h-0 min-w-0 flex-1 overflow-hidden"
        @pointerdown.capture="activatePane"
        @focusin.capture="activatePane"
        @wheel.capture="activatePane"
        @dragenter.capture="activatePane"
      >
        <canvas
          ref="sceneCanvasRef"
          :data-test-id="sceneCanvasTestId"
          :data-pane-id="paneId"
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 size-full outline-none"
        />
        <canvas
          ref="canvasRef"
          :data-test-id="canvasTestId"
          :data-pane-id="paneId"
          tabindex="-1"
          :style="{ cursor }"
          class="absolute inset-0 block size-full touch-none outline-none"
        />
        <div
          v-if="isActivePane"
          class="pointer-events-none absolute inset-0 z-30 ring-1 ring-accent/70 ring-inset"
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
