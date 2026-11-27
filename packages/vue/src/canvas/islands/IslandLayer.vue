<script setup lang="ts">
import { computed } from 'vue'

import {
  playIslandRoots,
  resolveEditorProfile,
  type EditorProfileInputs,
  type EditorState
} from '@open-pencil/core'
import type { ViewportTransform } from '@open-pencil/core/geometry'

import { useEditor } from '#vue/editor/context'

import Island from './Island.vue'
import { useIslandTokens } from './tokens'

/**
 * The live islands of a previewing canvas pane, laid over the canvas at its pan and zoom. The
 * canvas leaves these layers to the islands; wheel gestures over them still pan and zoom it.
 */
const { view, canvas, drawn } = defineProps<{
  view: Pick<EditorState, 'panX' | 'panY' | 'zoom' | 'currentPageId'> & EditorProfileInputs
  /** The canvas that wheel gestures over the islands are passed on to. */
  canvas: HTMLElement | null
  /**
   * The pan and zoom of the canvas's last drawn frame. The islands follow it rather than the
   * live view, which runs ahead of the drawing while panning and zooming fast.
   */
  drawn?: ViewportTransform | null
}>()

const placement = computed(() => drawn ?? view)
/** The run the islands belong to, or null while the canvas edits and draws every layer. */
const live = computed(() => resolveEditorProfile(view).live)
const editor = useEditor()

const tokens = useIslandTokens(computed(() => live.value !== null))

const islands = computed(() => {
  void editor.state.sceneVersion
  if (!live.value) return []
  return playIslandRoots(editor.graph, view.currentPageId).map((id) => ({
    id,
    position: editor.graph.getAbsolutePosition(id)
  }))
})

function forwardWheel(event: WheelEvent) {
  if (!canvas) return
  event.preventDefault()
  canvas.dispatchEvent(new WheelEvent(event.type, event))
}
</script>

<template>
  <div
    v-if="live"
    class="pointer-events-none absolute inset-0 overflow-hidden"
    data-test-id="play-islands"
    @wheel="forwardWheel"
  >
    <div
      class="absolute top-0 inset-s-0 origin-top-left"
      :style="{
        transform: `translate(${placement.panX}px, ${placement.panY}px) scale(${placement.zoom})`
      }"
    >
      <Island
        v-for="island in islands"
        :key="island.id"
        :root-id="island.id"
        :revision="live.revision"
        :tokens="tokens"
        class="pointer-events-auto absolute w-max"
        :style="{ left: `${island.position.x}px`, top: `${island.position.y}px` }"
      />
    </div>
  </div>
</template>
