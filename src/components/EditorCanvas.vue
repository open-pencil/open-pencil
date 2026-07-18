<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
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
import { useEditorStore } from '@/app/editor/active-store'
import { useCanvasCollaborationAwareness } from '@/app/editor/canvas/collaboration-awareness'
import { createCanvasContextSelection } from '@/app/editor/canvas/context-selection'
import { fadeOutGlobalLoader } from '@/app/editor/canvas/loader-overlay'
import IconLucidePanelBottom from '~icons/lucide/panel-bottom'
import IconLucidePanelLeft from '~icons/lucide/panel-left'
import IconLucidePanelRight from '~icons/lucide/panel-right'
import IconLucidePanelTop from '~icons/lucide/panel-top'
import CanvasMenu from './canvas/CanvasMenu.vue'
import NumberField from './inputs/NumberField.vue'

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
const { hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle, hitTestFrameTitles } = useCanvas(
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
  cancelAutoLayoutPaddingEdit,
  frameTitleRename,
  commitFrameTitleRename,
  cancelFrameTitleRename
} = useCanvasInput(
  canvasRef,
  store,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
  hitTestFrameTitles,
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

const renameAnchor = computed(() => {
  const edit = frameTitleRename.value
  if (!edit) return null
  const abs = store.graph.getAbsolutePosition(edit.nodeId)
  return abs ? { x: abs.x, y: abs.y } : null
})
const renameReference = useCanvasVirtualReference(canvasRef, store, renameAnchor)

function onRenameKeydown(e: KeyboardEvent) {
  if (e.code === 'Enter') {
    e.preventDefault()
    ;(e.target as HTMLInputElement).blur()
  } else if (e.code === 'Escape') {
    e.preventDefault()
    cancelFrameTitleRename()
  }
}

const renameInputRef = ref<HTMLInputElement | null>(null)
const renameMirrorRef = ref<HTMLSpanElement | null>(null)
const renameValue = ref('')

const renameMaxWidth = computed(() => {
  const edit = frameTitleRename.value
  if (!edit) return 120
  const node = store.graph.getNode(edit.nodeId)
  if (!node) return 120
  return Math.max(40, node.width * store.state.zoom)
})

function onRenameInput(e: Event) {
  renameValue.value = (e.target as HTMLInputElement).value
}

watch(
  () => frameTitleRename.value,
  (edit) => {
    if (edit) {
      renameValue.value = edit.name
      requestAnimationFrame(() => {
        const input = renameInputRef.value
        if (input) {
          input.focus()
          input.select()
        }
      })
    }
  }
)

watch(
  () => store.state.selectedIds,
  (selectedIds) => {
    const edit = frameTitleRename.value
    if (edit && !selectedIds.has(edit.nodeId)) {
      cancelFrameTitleRename()
    }
  }
)

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
              <NumberField
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
              </NumberField>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <PopoverRoot :open="!!frameTitleRename">
          <PopoverPortal>
            <PopoverContent
              v-if="frameTitleRename && renameReference"
              :reference="renameReference"
              side="top"
              align="start"
              :side-offset="4"
              :collision-padding="8"
              class="z-50 inline-block rounded-md bg-panel p-0.5 shadow-lg"
              data-test-id="frame-title-rename"
              :style="{ maxWidth: `${renameMaxWidth + 12}px` }"
              @open-auto-focus.prevent
            >
              <div class="relative inline-flex" :style="{ maxWidth: `${renameMaxWidth}px` }">
                <span
                  ref="renameMirrorRef"
                  class="invisible whitespace-pre rounded-sm px-1.5 py-0.5 text-xs"
                  aria-hidden="true"
                >{{ renameValue || ' ' }}&nbsp;</span>
                <input
                  ref="renameInputRef"
                  v-model="renameValue"
                  data-test-id="frame-title-rename-input"
                  class="absolute inset-0 w-full rounded-sm border border-transparent bg-panel-field px-1.5 py-0.5 text-xs text-surface outline-none focus:border-panel-focus"
                  @blur="commitFrameTitleRename(renameValue)"
                  @keydown="onRenameKeydown"
                />
              </div>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <Transition leave-active-class="transition-opacity duration-300" leave-to-class="opacity-0">
          <div
            v-if="store.state.loading"
            data-test-id="canvas-loading"
            class="absolute inset-0 z-50 flex items-center justify-center bg-canvas"
          >
            <icon-lucide-pencil-line class="size-8 text-surface opacity-45" />
            <div
              class="absolute bottom-1/2 left-1/2 h-0.5 w-25 -translate-x-1/2 translate-y-10 overflow-hidden rounded-full bg-surface/8"
            >
              <div
                class="h-full w-2/5 animate-[slide_1s_ease-in-out_infinite] rounded-full bg-surface/25"
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
