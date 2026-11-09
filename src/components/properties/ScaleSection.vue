<script setup lang="ts">
import { computed, ref } from 'vue'

import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import { canRescaleNode, isInsideInstance } from '@open-pencil/scene-graph/scaling'
import { useI18n } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

type ScaleAnchor = 'nw' | 'n' | 'ne' | 'w' | 'c' | 'e' | 'sw' | 's' | 'se'

const store = useEditorStore()
const { panels, tools } = useI18n()
const anchor = ref<ScaleAnchor>('nw')
const multiplier = ref(1)

const bounds = useSceneComputed<Rect | null>(() => {
  const nodes = store
    .getSelectedNodes()
    .filter((node) => canRescaleNode(node) && !isInsideInstance(node, store.graph))
  if (nodes.length === 0) return null
  return computeBounds(nodes.map((node) => getAxisAlignedWorldBounds(node, store.graph)))
})

const width = computed(() => bounds.value?.width ?? 0)
const height = computed(() => bounds.value?.height ?? 0)

const ANCHORS: ScaleAnchor[] = ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se']

const anchorLabels = computed<Record<ScaleAnchor, string>>(() => {
  const rows = [panels.value.alignTop, panels.value.alignCenterVertically, panels.value.alignBottom]
  const columns = [
    panels.value.alignLeft,
    panels.value.alignCenterHorizontally,
    panels.value.alignRight
  ]
  return {
    nw: `${rows[0]} ${columns[0]}`,
    n: `${rows[0]} ${columns[1]}`,
    ne: `${rows[0]} ${columns[2]}`,
    w: `${rows[1]} ${columns[0]}`,
    c: `${rows[1]} ${columns[1]}`,
    e: `${rows[1]} ${columns[2]}`,
    sw: `${rows[2]} ${columns[0]}`,
    s: `${rows[2]} ${columns[1]}`,
    se: `${rows[2]} ${columns[2]}`
  }
})

function anchored(from: Rect, scale: number): Rect {
  const width = from.width * scale
  const height = from.height * scale
  const horizontal = anchor.value.includes('w')
    ? from.x
    : anchor.value.includes('e')
      ? from.x + from.width - width
      : from.x + (from.width - width) / 2
  const vertical = anchor.value.includes('n')
    ? from.y
    : anchor.value.includes('s')
      ? from.y + from.height - height
      : from.y + (from.height - height) / 2
  return { x: horizontal, y: vertical, width, height }
}

function applyScale(scale: number) {
  const nodes = store
    .getSelectedNodes()
    .filter((node) => canRescaleNode(node) && !isInsideInstance(node, store.graph))
  const from = bounds.value
  if (!from || nodes.length === 0 || !Number.isFinite(scale) || scale <= 0) return
  store.scaleSelected(nodes, scale, from, anchored(from, scale))
  multiplier.value = 1
  store.requestRender()
}

function scaleByField(value: number, axis: 'width' | 'height') {
  const size = bounds.value?.[axis]
  if (!size) return
  applyScale(value / size)
}
</script>

<template>
  <PanelSection v-if="bounds" :label="tools.scale">
    <PanelGrid :columns="2">
      <NumberField
        icon="×"
        data-property="scale"
        :aria-label="panels.scaleMultiplier"
        :model-value="multiplier"
        :min="0.01"
        @update:model-value="multiplier = $event"
        @commit="(value: number) => applyScale(value)"
      />
      <div
        role="group"
        :aria-label="panels.scaleAnchor"
        class="grid w-fit grid-cols-3 gap-0.5 justify-self-end"
      >
        <IconButton
          v-for="id in ANCHORS"
          :key="id"
          :label="anchorLabels[id]"
          :active="anchor === id"
          size="xs"
          @click="anchor = id"
        >
          <span class="block size-1.5 rounded-full bg-current" />
        </IconButton>
      </div>
    </PanelGrid>
    <PanelGrid :columns="2" class="mt-1.5">
      <NumberField
        icon="W"
        data-property="width"
        :aria-label="panels.width"
        :model-value="width"
        :min="0.01"
        @commit="(value: number) => scaleByField(value, 'width')"
      />
      <NumberField
        icon="H"
        data-property="height"
        :aria-label="panels.height"
        :model-value="height"
        :min="0.01"
        @commit="(value: number) => scaleByField(value, 'height')"
      />
    </PanelGrid>
  </PanelSection>
</template>
