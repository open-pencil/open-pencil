<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import {
  AUTO_LAYOUT_PADDING_EDITOR_OFFSET_X,
  AUTO_LAYOUT_PADDING_EDITOR_OFFSET_Y
} from '@open-pencil/core/constants'
import {
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
  PopoverContent,
  PopoverPortal,
  PopoverRoot
} from 'reka-ui'

import {
  toolCursor,
  useCanvas,
  useCanvasDrop,
  useCanvasInput,
  useCanvasVirtualReference,
  useTextEdit
} from '@open-pencil/vue'
import { useCollabInjected } from '@/app/collab/use'
import { cloudActivityMessage } from '@/app/cloud/activity'
import { useEditorStore } from '@/app/editor/active-store'
import { useCanvasCollaborationAwareness } from '@/app/editor/canvas/collaboration-awareness'
import { createCanvasContextSelection } from '@/app/editor/canvas/context-selection'
import { fadeOutGlobalLoader } from '@/app/editor/canvas/loader-overlay'
import IconLucidePanelBottom from '~icons/lucide/panel-bottom'
import IconLucidePanelLeft from '~icons/lucide/panel-left'
import IconLucidePanelRight from '~icons/lucide/panel-right'
import IconLucidePanelTop from '~icons/lucide/panel-top'
import CanvasMenu from './canvas/CanvasMenu.vue'
import ScrubInput from './inputs/ScrubInput.vue'

const store = useEditorStore()
const collab = useCollabInjected()
const sceneCanvasRef = ref<HTMLCanvasElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const { updateCursor } = useCanvasCollaborationAwareness(store, collab)
const { selectAtContextPoint } = createCanvasContextSelection(canvasRef, store)

useCanvas(sceneCanvasRef, store, {
  layer: 'scene',
  showRulers: false,
  onReady: fadeOutGlobalLoader
})
const { hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = useCanvas(
  canvasRef,
  store,
  {
    layer: 'overlays'
  }
)
const {
  cursorOverride,
  autoLayoutPaddingEdit,
  updateAutoLayoutPaddingEdit,
  commitAutoLayoutPaddingEdit,
  cancelAutoLayoutPaddingEdit
} = useCanvasInput(
  canvasRef,
  store,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
  updateCursor
)

useTextEdit(canvasRef, store)
const { isDraggingOver } = useCanvasDrop(canvasRef, store)

const paddingSideIcons = {
  top: IconLucidePanelTop,
  right: IconLucidePanelRight,
  bottom: IconLucidePanelBottom,
  left: IconLucidePanelLeft
} satisfies Record<'top' | 'right' | 'bottom' | 'left', Component>

const paddingEditorAnchor = computed(() => {
  const edit = autoLayoutPaddingEdit.value
  if (!edit) return null
  const node = store.graph.getNode(edit.nodeId)
  if (!node) return null
  const abs = store.graph.getAbsolutePosition(node.id)
  if (edit.side === 'top') return { x: abs.x + node.width / 2, y: abs.y + node.paddingTop / 2 }
  if (edit.side === 'bottom') {
    return { x: abs.x + node.width / 2, y: abs.y + node.height - node.paddingBottom / 2 }
  }
  if (edit.side === 'left') return { x: abs.x + node.paddingLeft / 2, y: abs.y + node.height / 2 }
  return { x: abs.x + node.width - node.paddingRight / 2, y: abs.y + node.height / 2 }
})
const paddingEditorReference = useCanvasVirtualReference(canvasRef, store, paddingEditorAnchor)
const paddingEditorIcon = computed(() => {
  const edit = autoLayoutPaddingEdit.value
  return edit ? paddingSideIcons[edit.side] : IconLucidePanelTop
})

const cursor = computed(() => toolCursor(store.state.activeTool, cursorOverride.value))
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child @contextmenu="selectAtContextPoint">
      <div
        data-test-id="canvas-area"
        class="canvas-area relative min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        <canvas
          ref="sceneCanvasRef"
          data-test-id="scene-canvas-element"
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 size-full outline-none"
        />
        <canvas
          ref="canvasRef"
          data-test-id="canvas-element"
          tabindex="-1"
          :style="{ cursor }"
          class="absolute inset-0 block size-full touch-none outline-none"
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
        <PopoverRoot :open="!!autoLayoutPaddingEdit">
          <PopoverPortal>
            <PopoverContent
              v-if="autoLayoutPaddingEdit && paddingEditorReference"
              :reference="paddingEditorReference"
              side="top"
              align="center"
              :side-offset="AUTO_LAYOUT_PADDING_EDITOR_OFFSET_Y"
              :align-offset="AUTO_LAYOUT_PADDING_EDITOR_OFFSET_X"
              :collision-padding="8"
              class="z-50 w-20 rounded-md bg-panel p-1 shadow-lg"
              data-test-id="auto-layout-padding-editor"
              @keydown.escape.prevent="cancelAutoLayoutPaddingEdit"
              @open-auto-focus.prevent
            >
              <ScrubInput
                :model-value="autoLayoutPaddingEdit.value"
                :min="0"
                :step="1"
                data-test-id="auto-layout-padding-input"
                @update:model-value="updateAutoLayoutPaddingEdit"
                @commit="(value: number) => commitAutoLayoutPaddingEdit(value)"
                @editing-change="
                  (editing: boolean) =>
                    !editing &&
                    autoLayoutPaddingEdit &&
                    commitAutoLayoutPaddingEdit(autoLayoutPaddingEdit.value)
                "
              >
                <template #icon>
                  <component :is="paddingEditorIcon" class="size-3.5" />
                </template>
              </ScrubInput>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <Transition leave-active-class="transition-opacity duration-300" leave-to-class="opacity-0">
          <div
            v-if="store.state.loading"
            data-test-id="canvas-loading"
            class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-canvas"
          >
            <icon-lucide-cloud v-if="cloudActivityMessage" class="size-8 text-surface opacity-45" />
            <icon-lucide-pencil-line v-else class="size-8 text-surface opacity-45" />
            <div class="h-0.5 w-25 overflow-hidden rounded-full bg-surface/8">
              <div
                class="h-full w-2/5 animate-[slide_1s_ease-in-out_infinite] rounded-full bg-surface/25"
              />
            </div>
            <p
              class="max-w-xs px-4 text-center text-xs text-muted"
              data-test-id="canvas-loading-message"
            >
              {{ cloudActivityMessage ?? 'Loading…' }}
            </p>
          </div>
        </Transition>
      </div>
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <CanvasMenu />
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
