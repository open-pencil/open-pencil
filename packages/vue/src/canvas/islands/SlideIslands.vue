<script setup lang="ts">
import { computed } from 'vue'

import Island from './Island.vue'
import { useIslandTokens } from './tokens'

/**
 * The live islands of a slide being presented: its layers that hold controls, laid over the slide
 * where the presentation draws it, as large as it shows it. The presentation leaves those layers
 * to the islands while nothing moves.
 */
const { islands, placement, revision, faded } = defineProps<{
  /** The layers, each at its place on the slide. */
  islands: readonly { id: string; x: number; y: number }[]
  /** Layers inside them the presentation keeps off the slide for now: they are drawn transparent. */
  faded: ReadonlySet<string>
  /** Where the slide's corner is on screen, in CSS pixels, and how large it is drawn. */
  placement: { x: number; y: number; scale: number }
  /** Changing it starts every control again as designed. */
  revision: number
}>()

const tokens = useIslandTokens(computed(() => islands.length > 0))
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden" data-test-id="slide-islands">
    <div
      class="absolute top-0 inset-s-0 origin-top-left"
      :style="{
        transform: `translate(${placement.x}px, ${placement.y}px) scale(${placement.scale})`
      }"
    >
      <Island
        v-for="island in islands"
        :key="island.id"
        :root-id="island.id"
        :revision="revision"
        :tokens="tokens"
        :faded="faded"
        class="pointer-events-auto absolute w-max"
        :style="{ left: `${island.x}px`, top: `${island.y}px` }"
      />
    </div>
  </div>
</template>
