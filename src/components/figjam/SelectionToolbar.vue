<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { computed } from 'vue'

import type { ViewportTransform } from '@open-pencil/core/geometry'
import { isGeneratedFrame } from '@open-pencil/scene-graph/generated'
import { useCanvasVirtualReference } from '@open-pencil/vue/canvas/overlays'

import { useEditorStore } from '@/app/editor/active-store'
import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

import ConnectorSection from './connector/ConnectorSection.vue'
import ShapeWithTextSection from './shape-with-text/ShapeWithTextSection.vue'
import StickySection from './sticky/StickySection.vue'

const { canvas, view, hidden } = defineProps<{
  canvas: HTMLCanvasElement | null
  /** The pan and zoom the canvas was last drawn with, which the controls follow. */
  view: ViewportTransform
  /** Whether something else owns the selection's surroundings now, such as a drag. */
  hidden: boolean
}>()

const SELECTION_TOOLBAR_GAP = 12

const store = useEditorStore()

/** The top-right corner of the selection, while every selected layer is a sticky, shape, or connector. */
const anchor = computed(() => {
  void store.state.sceneVersion
  const ids = [...store.state.selectedIds]
  const nodes = ids.map((id) => store.graph.getNode(id))
  if (nodes.length === 0 || !nodes.every((node) => node && isGeneratedFrame(node))) return null
  const bounds = ids.map((id) => store.graph.getAbsoluteBounds(id))
  return {
    x: Math.max(...bounds.map((b) => b.x + b.width)),
    y: Math.min(...bounds.map((b) => b.y))
  }
})
const reference = useCanvasVirtualReference(
  computed(() => canvas),
  () => view,
  anchor
)
const open = computed(() => !hidden && store.state.editingTextId === null && !!reference.value)
</script>

<template>
  <PopoverRoot :open="open">
    <PopoverPortal>
      <PopoverContent
        v-if="open && reference"
        :reference="reference"
        side="right"
        align="start"
        :side-offset="SELECTION_TOOLBAR_GAP"
        :collision-padding="8"
        :class="['z-40 w-[240px] py-1 [&>*]:border-b-0', floatingSurface, motionStyles.floating]"
        data-test-id="selection-toolbar"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
      >
        <StickySection />
        <ShapeWithTextSection />
        <ConnectorSection />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
