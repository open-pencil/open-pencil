<script setup lang="ts">
import type { PagePlacement } from '@/app/live-pages/placement'
import type { LivePage } from '@/app/live-pages/schema'

/**
 * One page of the running application, drawn over the canvas: the frame's own layers stay under
 * it, so a design can be laid on top of the page it replaces.
 */
const { page, placement, revision, interactive, nodeId } = defineProps<{
  page: LivePage
  placement: PagePlacement
  /** A new revision remounts the page, which is how the page reloads. */
  revision: number
  /** Whether the page takes the pointer, or leaves every gesture to the canvas. */
  interactive: boolean
  /** The frame this page draws on, which the layer reads back to name the frame that posted. */
  nodeId: string
}>()
</script>

<template>
  <div
    class="absolute overflow-hidden"
    :class="interactive ? 'pointer-events-auto' : 'pointer-events-none'"
    :style="{
      left: `${placement.left}px`,
      top: `${placement.top}px`,
      width: `${placement.width}px`,
      height: `${placement.height}px`
    }"
    data-test-id="live-page-frame"
  >
    <iframe
      :key="revision"
      :src="page.url"
      :aria-label="page.label ?? page.url"
      :data-node-id="nodeId"
      class="size-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      referrerpolicy="no-referrer"
      loading="lazy"
      data-test-id="live-page-iframe"
    />
  </div>
</template>
