<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { LayoutAlign, LayoutCounterAlign } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import { MIN_RESCALE, scaleRoots } from '@open-pencil/scene-graph/scaling'
import { useI18n } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'
import { useRetainedPopup } from '@open-pencil/vue/lifecycle/retention'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import LayoutAlignmentControl from '@/components/properties/layout/alignment/LayoutAlignmentControl.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelectContent from '@/components/ui/select/AppSelectContent.vue'
import AppSelectItem from '@/components/ui/select/AppSelectItem.vue'
import AppSelectRoot from '@/components/ui/select/AppSelectRoot.vue'
import SelectFieldTrigger from '@/components/ui/select/SelectFieldTrigger.vue'

/** The factors Figma's Scale field offers. */
const SCALE_PRESETS = [0.25, 0.5, 0.75, 1, 2, 3, 4, 5, 10] as const
const ANCHOR_STOPS: Array<{ fraction: number; align: LayoutAlign & LayoutCounterAlign }> = [
  { fraction: 0, align: 'MIN' },
  { fraction: 0.5, align: 'CENTER' },
  { fraction: 1, align: 'MAX' }
]

const store = useEditorStore()
const { panels, tools, common } = useI18n()

/** The box the Scale tool scales, and how it lies on the canvas. */
interface ScaleBox {
  width: number
  height: number
  /** Draws the box from its own (0,0)…(width,height) on the canvas. */
  world: Mat3
}

/**
 * The box the handles show: a single layer's own, turned as it is, as Figma reports its size, or
 * the canvas box of a multi-selection, locked layers included.
 */
const bounds = useSceneComputed<ScaleBox | null>(() => {
  const selected = store.getSelectedNodes()
  if (scaleRoots(store.graph, selected).length === 0) return null
  if (selected.length === 1) {
    const [node] = selected
    return { width: node.width, height: node.height, world: getWorldMatrix(node, store.graph) }
  }
  const box = computeBounds(selected.map((node) => getAxisAlignedWorldBounds(node, store.graph)))
  return { width: box.width, height: box.height, world: Matrix.translated(box.x, box.y) }
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
  const [ax, ay] = Matrix.mapPoints(box.world, [box.width * x, box.height * y])
  store.scaleSelected(scale, { x: ax, y: ay })
}

function scaleToSize(value: number, axis: 'width' | 'height') {
  const size = bounds.value?.[axis]
  if (size) scaleBy(value / size)
}

/** A factor scales from the size the selection started at. */
function setFactor(value: number) {
  const width = bounds.value?.width
  if (!width || startWidth.value <= 0) return
  scaleBy((value * startWidth.value) / width)
}

const { open: presetsOpen, portalActive } = useRetainedPopup()
const factorAnchor = ref<HTMLElement | null>(null)
// The factor the field shows while it is scrubbed, before the release scales the selection.
const draftFactor = ref<number | null>(null)
const typingFactor = ref(false)

/** A typed factor hands back to the Move tool, as in Figma; a scrub or a preset stays. */
function commitFactor(value: number) {
  draftFactor.value = null
  setFactor(value)
  if (typingFactor.value) store.setTool('SELECT')
}

function pickPreset(value: unknown) {
  if (typeof value === 'number') setFactor(value)
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
      <AppSelectRoot
        v-model:open="presetsOpen"
        :model-value="factor"
        @update:model-value="pickPreset"
      >
        <div ref="factorAnchor" class="min-w-0">
          <NumberField
            data-property="scale"
            :aria-label="panels.scaleMultiplier"
            :model-value="draftFactor ?? factor"
            :min="MIN_RESCALE"
            :step="0.01"
            suffix="x"
            @editing-change="typingFactor = $event"
            @update:model-value="draftFactor = $event"
            @commit="(value: number) => commitFactor(value)"
            @cancel="draftFactor = null"
          >
            <template #icon>
              <icon-lucide-scaling class="size-3.5" />
            </template>
            <template #suffix>
              <SelectFieldTrigger
                :label="panels.scaleMultiplier"
                :reference="factorAnchor ?? undefined"
              />
            </template>
          </NumberField>
        </div>
        <AppSelectContent v-if="portalActive" align="end">
          <AppSelectItem v-for="preset in SCALE_PRESETS" :key="preset" :value="preset">
            {{ preset }}x
          </AppSelectItem>
        </AppSelectContent>
      </AppSelectRoot>
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
