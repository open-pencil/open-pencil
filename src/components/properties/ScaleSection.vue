<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { LayoutAlign, LayoutCounterAlign } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import { MIN_RESCALE, scaleRoots } from '@open-pencil/scene-graph/scaling'
import { useI18n } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import ExportScaleInput from '@/components/properties/ExportScaleInput.vue'
import LayoutAlignmentControl from '@/components/properties/layout/alignment/LayoutAlignmentControl.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

/** The factors Figma's Scale field offers. */
const SCALE_PRESETS = [0.25, 0.5, 0.75, 1, 2, 3, 4, 5, 10] as const
const ANCHOR_STOPS: Array<{ fraction: number; align: LayoutAlign & LayoutCounterAlign }> = [
  { fraction: 0, align: 'MIN' },
  { fraction: 0.5, align: 'CENTER' },
  { fraction: 1, align: 'MAX' }
]

const store = useEditorStore()
const { panels, tools, common } = useI18n()

/** The box of the layers the Scale tool scales, on the canvas. */
const bounds = useSceneComputed<Rect | null>(() => {
  const roots = scaleRoots(store.graph, store.getSelectedNodes())
  if (roots.length === 0) return null
  return computeBounds(roots.map((node) => getAxisAlignedWorldBounds(node, store.graph)))
})

// The factor counts from the size the selection had when the tool or the selection was picked.
const startWidth = ref(0)
watch(
  () => [...store.state.selectedIds].join(','),
  () => (startWidth.value = bounds.value?.width ?? 0),
  { immediate: true }
)
const factor = computed(() => {
  const width = bounds.value?.width ?? 0
  return startWidth.value > 0 ? Math.round((width / startWidth.value) * 100) / 100 : 1
})

const anchorCells = computed(() => {
  const rows = [panels.value.alignTop, panels.value.alignCenterVertically, panels.value.alignBottom]
  const columns = [
    panels.value.alignLeft,
    panels.value.alignCenterHorizontally,
    panels.value.alignRight
  ]
  const { x, y } = store.state.scaleAnchor
  return ANCHOR_STOPS.flatMap((row, rowIndex) =>
    ANCHOR_STOPS.map((column, columnIndex) => ({
      primary: column.align,
      counter: row.align,
      label: `${rows[rowIndex]} ${columns[columnIndex]}`,
      active: column.fraction === x && row.fraction === y
    }))
  )
})

function fractionOf(align: LayoutAlign | LayoutCounterAlign): number {
  return ANCHOR_STOPS.find((stop) => stop.align === align)?.fraction ?? 0.5
}

/** Scales the selection by `scale` about the anchor point of its box. */
function scaleBy(scale: number) {
  const box = bounds.value
  if (!box || !Number.isFinite(scale) || scale < MIN_RESCALE) return
  const { x, y } = store.state.scaleAnchor
  store.scaleSelected(scale, { x: box.x + box.width * x, y: box.y + box.height * y })
}

function scaleToSize(value: number, axis: 'width' | 'height') {
  const size = bounds.value?.[axis]
  if (size) scaleBy(value / size)
}

/** A factor scales from the starting size, then hands back to the Move tool, as in Figma. */
function setFactor(value: number) {
  const width = bounds.value?.width
  if (!width || startWidth.value <= 0) return
  scaleBy((value * startWidth.value) / width)
  store.setTool('SELECT')
}
</script>

<template>
  <PanelSection v-if="bounds" :label="tools.scale">
    <template #actions>
      <IconButton :label="common.close" @click="store.setTool('SELECT')">
        <icon-lucide-x class="size-3.5" />
      </IconButton>
    </template>
    <PanelGrid :columns="2">
      <NumberField
        icon="W"
        data-property="scale-width"
        :aria-label="panels.width"
        :model-value="bounds.width"
        :min="MIN_RESCALE"
        @commit="(value: number) => scaleToSize(value, 'width')"
      />
      <NumberField
        icon="H"
        data-property="scale-height"
        :aria-label="panels.height"
        :model-value="bounds.height"
        :min="MIN_RESCALE"
        @commit="(value: number) => scaleToSize(value, 'height')"
      />
    </PanelGrid>
    <div class="mt-1.5 grid grid-cols-[minmax(0,1fr)_4.875rem] items-start gap-3">
      <ExportScaleInput
        data-property="scale"
        :label="panels.scaleMultiplier"
        :model-value="factor"
        :presets="SCALE_PRESETS"
        :clamp="(value: number) => Math.max(MIN_RESCALE, value)"
        @update:model-value="setFactor"
      />
      <LayoutAlignmentControl
        :label="panels.scaleAnchor"
        :cells="anchorCells"
        @select="
          (primary, counter) =>
            store.setScaleAnchor({ x: fractionOf(primary), y: fractionOf(counter) })
        "
      />
    </div>
  </PanelSection>
</template>
