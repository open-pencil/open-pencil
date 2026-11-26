<script setup lang="ts">
import { useElementSize, useEventListener, useFullscreen } from '@vueuse/core'
import { noop } from 'es-toolkit/function'
import { computed, onMounted, onUnmounted, useTemplateRef, watch } from 'vue'

import { slideIslandRoots, type CanvasView, type EditorState } from '@open-pencil/core'
import { placeSlide } from '@open-pencil/core/present'
import { SlideIslands } from '@open-pencil/vue/canvas'
import { useCanvas } from '@open-pencil/vue/canvas/surface'
import { useMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { usePresenterLink } from '@/app/editor/present/link'

/**
 * A deck being presented, filling the screen: its own canvas draws the slide on show and the
 * motion between steps and slides. Keys and clicks move through the deck; Escape, or leaving full
 * screen, ends it.
 */
const store = useEditorStore()
const messages = useMessages('slides')
const root = useTemplateRef<HTMLElement>('root')
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

const status = computed(() => store.state.presentation)
const { width, height } = useElementSize(root)

/**
 * The slide on show's layers that hold controls, run as live islands while nothing moves; a layer
 * its build has not brought on yet stays hidden. While a step or a transition moves, the canvas
 * draws them, so they move with the rest.
 */
const islands = computed(() => {
  const current = status.value
  const slideId = current?.slideIds[current.index]
  if (!current || current.moving || !slideId) return []
  void current.played
  const resting = store.presentationScene().layers
  return slideIslandRoots(store.graph, slideId).flatMap((id) => {
    const node = store.graph.getNode(id)
    if (!node || resting.get(id)?.opacity === 0) return []
    return [{ id, x: node.x, y: node.y }]
  })
})
const islandIds = computed(() => new Set(islands.value.map((island) => island.id)))
const placement = computed(() => {
  const current = status.value
  const slide = current && store.graph.getNode(current.slideIds[current.index] ?? '')
  return slide
    ? placeSlide(slide.width, slide.height, width.value, height.value)
    : { x: 0, y: 0, scale: 1 }
})

const view: CanvasView = {
  id: 'present',
  scene: () => ({ ...store.presentationScene(), islands: islandIds.value })
}
/** The editor's state with this canvas's view; its pan and zoom go unused. */
const getRenderState = (): EditorState => ({ ...store.state, canvasView: view })

usePresenterLink(store)

// The canvas sizes only itself: the editor's own viewport stays as it was.
useCanvas(canvasRef, store, { showRulers: false, getRenderState, onViewportResize: noop })

const counter = computed(() =>
  status.value
    ? messages.value.presentedSlide({
        number: String(status.value.index + 1),
        total: String(status.value.slideIds.length)
      })
    : ''
)

const { isFullscreen, enter, exit } = useFullscreen(root)
let wasFullscreen = false
onMounted(() => {
  // A browser may refuse full screen; the deck then fills the window.
  enter().catch(noop)
  root.value?.focus()
})
watch(isFullscreen, (full) => {
  if (full) wasFullscreen = true
  else if (wasFullscreen) store.stopPresenting()
})
onUnmounted(() => {
  if (isFullscreen.value) exit().catch(noop)
})

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'])
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'])

// The window's keys, before anything else hears them: the menu that started the deck hands focus
// back to its button, and the editor behind the deck takes no keys while it shows.
useEventListener(
  window,
  'keydown',
  (event: KeyboardEvent) => {
    if (NEXT_KEYS.has(event.key)) store.presentNext()
    else if (PREVIOUS_KEYS.has(event.key)) store.presentPrevious()
    else if (event.key === 'Home') store.presentSlide(0)
    else if (event.key === 'End') store.presentSlide((status.value?.slideIds.length ?? 1) - 1)
    else if (event.key === 'Escape') store.stopPresenting()
    else return
    event.preventDefault()
    event.stopPropagation()
  },
  { capture: true }
)

function onPointerDown(event: PointerEvent) {
  if (event.button === 0) store.presentNext()
  else if (event.button === 2) store.presentPrevious()
}
</script>

<template>
  <div
    ref="root"
    tabindex="-1"
    dir="ltr"
    role="application"
    :aria-label="counter"
    data-test-id="slides-presentation"
    class="fixed inset-0 z-50 bg-black outline-none"
    @pointerdown="onPointerDown"
    @contextmenu.prevent
  >
    <canvas ref="canvas" class="block size-full" />
    <SlideIslands
      v-if="islands.length > 0"
      :islands="islands"
      :placement="placement"
      :revision="0"
      @pointerdown.stop
    />
    <button
      type="button"
      :aria-label="messages.exitPresentation"
      class="sr-only"
      @click="store.stopPresenting()"
    />
  </div>
</template>
