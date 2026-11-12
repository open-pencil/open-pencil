<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, ref } from 'vue'

import { resolveEditorProfile, type EditorProfileInputs, type EditorState } from '@open-pencil/core'
import type { ViewportTransform } from '@open-pencil/core/geometry'

import { pageOrigin, readLiveSelection } from '@/app/live-pages/bridge'
import { layerTransform } from '@/app/live-pages/placement'
import { useLivePageSelection } from '@/app/live-pages/selection'
import { useLivePages } from '@/app/live-pages/use'

import LivePageFrame from './LivePageFrame.vue'

/**
 * The pages of the running application, laid over the canvas at its pan and zoom. The layer takes
 * no pointer while editing, so selecting and panning stay the canvas's; a previewing pane hands
 * the pointer to the page itself.
 */
const {
  view,
  canvas,
  drawn = null
} = defineProps<{
  view: Pick<EditorState, 'panX' | 'panY' | 'zoom' | 'currentPageId'> & EditorProfileInputs
  /** The canvas that wheel gestures over a page are passed on to. */
  canvas: HTMLElement | null
  /**
   * The pan and zoom of the canvas's last drawn frame. Pages follow it rather than the live view,
   * which runs ahead of the drawing while panning and zooming fast.
   */
  drawn?: ViewportTransform | null
}>()

const { pages, placementOf, revisionOf } = useLivePages({ pageId: () => view.currentPageId })
const { setSelection } = useLivePageSelection()
const placement = computed(() => drawn ?? view)
const transform = computed(() => layerTransform(placement.value))
const interactive = computed(() => resolveEditorProfile(view).live !== null)
const root = ref<HTMLElement | null>(null)

/** The origins a selection may come from: only the pages this layer shows. */
const origins = computed(() => {
  const allowed = new Set<string>()
  for (const entry of pages.value) {
    const origin = pageOrigin(entry.page.url)
    if (origin !== null) allowed.add(origin)
  }
  return allowed
})

/**
 * The frame whose page posted a message: the window a page reports from is its own iframe, so it
 * names the frame even when two of them show the same application. A popup the page opened, or a
 * frame that has navigated somewhere else, is not one of these and reports nothing.
 */
function reportingFrame(source: MessageEventSource | null): string | null {
  if (source === null || root.value === null) return null
  for (const frame of root.value.querySelectorAll<HTMLIFrameElement>(
    '[data-test-id="live-page-iframe"]'
  )) {
    if (frame.contentWindow === source) return frame.dataset.nodeId ?? null
  }
  return null
}

function onMessage(event: MessageEvent): void {
  const nodeId = reportingFrame(event.source)
  if (nodeId === null || !origins.value.has(event.origin)) return
  const picked = readLiveSelection(event.data)
  if (picked !== null) setSelection(nodeId, picked)
}

useEventListener(window, 'message', onMessage)

function forwardWheel(event: WheelEvent) {
  if (!canvas) return
  event.preventDefault()
  canvas.dispatchEvent(new WheelEvent(event.type, event))
}
</script>

<template>
  <div
    ref="root"
    class="pointer-events-none absolute inset-0 overflow-hidden"
    data-test-id="live-pages"
    @wheel="forwardWheel"
  >
    <div class="absolute top-0 inset-s-0 origin-top-left" :style="{ transform }">
      <LivePageFrame
        v-for="entry in pages"
        :key="entry.nodeId"
        :node-id="entry.nodeId"
        :page="entry.page"
        :placement="placementOf(entry)"
        :revision="revisionOf(entry.nodeId)"
        :interactive="interactive"
      />
    </div>
  </div>
</template>
