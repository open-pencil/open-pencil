<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import { logSplitPaneDebug } from '@/app/editor/panes/debug'
import { childKey } from '@/app/editor/panes/split-tree'
import EditorCanvasPane from '@/components/CanvasPanes/EditorCanvasPane.vue'

import type {
  CanvasSplitNode as CanvasSplitNodeModel,
  SplitDirection
} from '@/app/editor/panes/types'

const { node } = defineProps<{
  node: CanvasSplitNodeModel
}>()

const store = useEditorStore()
const MIN_CANVAS_PANE_SIZE_PERCENT = 12

type SplitDragState = {
  splitId: string
  index: number
  direction: SplitDirection
  startClientPosition: number
  containerSize: number
  startSizes: number[]
}

const drag = ref<SplitDragState | null>(null)

function childSize(index: number): number {
  if (node.type === 'pane') return 100
  return node.sizes[index] ?? 100 / node.children.length
}

function childStyle(index: number) {
  return { flex: `0 0 ${childSize(index)}%` }
}

function clientPosition(event: MouseEvent, direction: SplitDirection): number {
  return direction === 'horizontal' ? event.clientX : event.clientY
}

function containerSize(element: HTMLElement, direction: SplitDirection): number {
  const rect = element.getBoundingClientRect()
  return direction === 'horizontal' ? rect.width : rect.height
}

function currentSizes(): number[] {
  if (node.type === 'pane') return [100]
  return node.children.map((_, index) => childSize(index))
}

function resizeAdjacentPanels(state: SplitDragState, event: MouseEvent): number[] {
  const sizes = [...state.startSizes]
  const first = state.index
  const second = state.index + 1
  const total = state.startSizes[first] + state.startSizes[second]
  const delta =
    ((clientPosition(event, state.direction) - state.startClientPosition) / state.containerSize) *
    100
  const nextFirst = Math.min(
    total - MIN_CANVAS_PANE_SIZE_PERCENT,
    Math.max(MIN_CANVAS_PANE_SIZE_PERCENT, state.startSizes[first] + delta)
  )
  sizes[first] = nextFirst
  sizes[second] = total - nextFirst
  return sizes
}

function startSplitDrag(
  event: MouseEvent,
  splitId: string,
  index: number,
  direction: SplitDirection
) {
  const container =
    event.currentTarget instanceof HTMLElement
      ? event.currentTarget.closest<HTMLElement>('[data-canvas-split-container]')
      : null
  if (!container) return

  event.preventDefault()
  event.stopPropagation()

  drag.value = {
    splitId,
    index,
    direction,
    startClientPosition: clientPosition(event, direction),
    containerSize: containerSize(container, direction),
    startSizes: currentSizes()
  }
  store.setSplitResizeActive(true)
  logSplitPaneDebug('dragging', { splitId, handleIndex: index, dragging: true })
}

function finishSplitDrag(event?: MouseEvent) {
  const current = drag.value
  if (!current) return
  event?.preventDefault()
  drag.value = null
  store.setSplitResizeActive(false)
  logSplitPaneDebug('dragging', {
    splitId: current.splitId,
    handleIndex: current.index,
    dragging: false
  })
}

useEventListener(window, 'mousemove', (event) => {
  const current = drag.value
  if (!current) return
  event.preventDefault()
  const sizes = resizeAdjacentPanels(current, event)
  logSplitPaneDebug('layout', { splitId: current.splitId, sizes })
  store.updateSplitSizes(current.splitId, sizes)
})

useEventListener(window, 'mouseup', (event) => {
  logSplitPaneDebug('window-mouseup', {
    button: event.button,
    buttons: event.buttons,
    target: event.target instanceof HTMLElement ? event.target.tagName : null,
    activeHandle: null
  })
  finishSplitDrag(event)
})

useEventListener(window, 'blur', () => finishSplitDrag())
</script>

<template>
  <EditorCanvasPane v-if="node.type === 'pane'" :pane-id="node.paneId" />
  <div
    v-else
    :id="`canvas-split-${node.id}`"
    data-canvas-split-container
    :class="
      node.direction === 'horizontal'
        ? 'flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden'
        : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
    "
  >
    <template v-for="(child, index) in node.children" :key="childKey(child)">
      <div class="flex min-h-0 min-w-0 overflow-hidden" :style="childStyle(index)">
        <CanvasSplitNode :node="child" />
      </div>

      <div
        v-if="index < node.children.length - 1"
        :class="
          node.direction === 'horizontal'
            ? 'relative z-50 w-0 shrink-0'
            : 'relative z-50 h-0 shrink-0'
        "
      >
        <div
          :id="`canvas-split-handle-${node.id}-${index}`"
          :class="
            node.direction === 'horizontal'
              ? 'absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 cursor-col-resize touch-none select-none'
              : 'absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 cursor-row-resize touch-none select-none'
          "
          role="separator"
          :aria-orientation="node.direction === 'horizontal' ? 'vertical' : 'horizontal'"
          @mousedown="(event) => startSplitDrag(event, node.id, index, node.direction)"
        />
      </div>
    </template>
  </div>
</template>
