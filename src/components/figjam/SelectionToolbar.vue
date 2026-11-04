<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { figJamToolbarKind } from '@open-pencil/core'
import type { ViewportTransform } from '@open-pencil/core/geometry'
import { useCanvasVirtualReference } from '@open-pencil/vue/canvas/overlays'

import { useEditorStore } from '@/app/editor/active-store'
import theme from '@/theme/figjam/toolbar'
import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

import ArrangeTools from './toolbar/ArrangeTools.vue'
import ConnectorTools from './toolbar/ConnectorTools.vue'
import LayerTools from './toolbar/LayerTools.vue'
import SectionTools from './toolbar/SectionTools.vue'
import ShapeTools from './toolbar/ShapeTools.vue'
import StickyTools from './toolbar/StickyTools.vue'
import TextTools from './toolbar/TextTools.vue'

/**
 * FigJam's selection toolbar: a bar centred above the selection with the menus its kind of layer
 * has, and for several layers a way to align them and wrap them in a section.
 */
const { canvas, view, hidden } = defineProps<{
  canvas: HTMLCanvasElement | null
  /** The pan and zoom the canvas was last drawn with, which the toolbar follows. */
  view: ViewportTransform
  /** Whether something else owns the selection's surroundings now, such as a drag. */
  hidden: boolean
}>()
const emit = defineEmits<{ renameSection: [] }>()

/** Measured in FigJam: the bar's room above a selection, and above layers with handles there. */
const TOOLBAR_GAP = 16
const TOOLBAR_GAP_OVER_HANDLES = 40

const store = useEditorStore()
const styles = tv(theme)()

/** The top centre of the selection. */
const anchor = computed(() => {
  void store.state.sceneVersion
  const ids = [...store.state.selectedIds]
  if (ids.length === 0 || ids.some((id) => !store.graph.getNode(id))) return null
  const bounds = ids.map((id) => store.graph.getAbsoluteBounds(id))
  const left = Math.min(...bounds.map((b) => b.x))
  const right = Math.max(...bounds.map((b) => b.x + b.width))
  return { x: (left + right) / 2, y: Math.min(...bounds.map((b) => b.y)) }
})
const reference = useCanvasVirtualReference(
  computed(() => canvas),
  () => view,
  anchor
)
/** The selected layers, read again as the scene changes. */
const layers = computed(() => {
  void store.state.sceneVersion
  return [...store.state.selectedIds].flatMap((id) => store.graph.getNode(id) ?? [])
})
const kind = computed(() => figJamToolbarKind(layers.value))
const several = computed(() => layers.value.length > 1)
const gap = computed(() =>
  kind.value === 'sticky' || kind.value === 'shape' || kind.value === 'section'
    ? TOOLBAR_GAP_OVER_HANDLES
    : TOOLBAR_GAP
)
/** Whether only text is selected, which takes a colour; text with sticky notes shares text menus. */
const textOnly = computed(() => layers.value.every((layer) => layer.type === 'TEXT'))
const hasTools = computed(
  () => kind.value !== null && ((kind.value !== 'mixed' && kind.value !== 'image') || several.value)
)
const open = computed(
  () => !hidden && store.state.editingTextId === null && !!reference.value && hasTools.value
)
</script>

<template>
  <PopoverRoot :open="open">
    <PopoverPortal>
      <PopoverContent
        v-if="open && reference"
        :reference="reference"
        side="top"
        align="center"
        :side-offset="gap"
        :collision-padding="8"
        :class="['z-40', styles.bar(), floatingSurface, motionStyles.floating]"
        role="toolbar"
        data-test-id="selection-toolbar"
        :data-kind="kind"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
        @interact-outside.prevent
      >
        <StickyTools v-if="kind === 'sticky'" />
        <ShapeTools v-else-if="kind === 'shape'" />
        <ConnectorTools v-else-if="kind === 'connector'" />
        <SectionTools
          v-else-if="kind === 'section'"
          :single="!several"
          :locked="layers.every((layer) => layer.locked)"
          @rename="emit('renameSection')"
        />
        <template v-else-if="kind === 'text'">
          <template v-if="textOnly">
            <LayerTools />
            <span :class="styles.divider()" />
          </template>
          <TextTools :align="!several" />
        </template>
        <LayerTools
          v-else-if="kind === 'layer' || kind === 'group'"
          :ungroup="kind === 'group' && !several"
        />
        <template v-if="several">
          <span v-if="kind !== 'mixed' && kind !== 'image'" :class="styles.divider()" />
          <ArrangeTools />
        </template>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
