<script setup lang="ts">
import { computed } from 'vue'

import { playIslandRoots, type PlayState } from '@open-pencil/core/editor'

import { useEditor } from '#vue/editor/context'

import Island from './Island.vue'

/**
 * The live islands of a previewing canvas pane, laid over the canvas at its pan and zoom. The
 * canvas leaves these layers to the islands; wheel gestures over them still pan and zoom it.
 */
const { view, canvas } = defineProps<{
  view: { panX: number; panY: number; zoom: number; currentPageId: string; play: PlayState | null }
  /** The canvas that wheel gestures over the islands are passed on to. */
  canvas: HTMLElement | null
}>()
const editor = useEditor()

const islands = computed(() => {
  void editor.state.sceneVersion
  if (!view.play) return []
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
    v-if="view.play"
    class="pointer-events-none absolute inset-0 overflow-hidden"
    data-test-id="play-islands"
    @wheel="forwardWheel"
  >
    <div
      class="absolute top-0 left-0 origin-top-left"
      :style="{ transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})` }"
    >
      <Island
        v-for="island in islands"
        :key="island.id"
        :root-id="island.id"
        :revision="view.play.revision"
        class="pointer-events-auto absolute"
        :style="{ left: `${island.position.x}px`, top: `${island.position.y}px` }"
      />
    </div>
  </div>
</template>
