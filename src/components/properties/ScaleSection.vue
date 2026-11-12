<script setup lang="ts">
import { computed, ref } from 'vue'

import type { LayoutAlign, LayoutCounterAlign } from '@open-pencil/scene-graph'
import { MIN_RESCALE } from '@open-pencil/scene-graph/scaling'
import { useScaleControls } from '@open-pencil/vue/controls/scale'
import { useI18n } from '@open-pencil/vue/i18n'
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
const scale = useScaleControls()
const { box, factor, anchor } = scale

const anchorCells = computed(() => {
  const rows = [panels.value.alignTop, panels.value.alignCenterVertically, panels.value.alignBottom]
  const columns = [
    panels.value.alignLeft,
    panels.value.alignCenterHorizontally,
    panels.value.alignRight
  ]
  return ANCHOR_STOPS.flatMap((row, rowIndex) =>
    ANCHOR_STOPS.map((column, columnIndex) => ({
      primary: column.align,
      counter: row.align,
      label: `${rows[rowIndex]} ${columns[columnIndex]}`,
      active: column.fraction === anchor.value.x && row.fraction === anchor.value.y
    }))
  )
})

function fractionOf(align: LayoutAlign | LayoutCounterAlign): number {
  return ANCHOR_STOPS.find((stop) => stop.align === align)?.fraction ?? 0.5
}

const { open: presetsOpen, portalActive } = useRetainedPopup()
const factorAnchor = ref<HTMLElement | null>(null)
// The factor the field shows while it is scrubbed, as the canvas follows it.
const draftFactor = ref<number | null>(null)
const typingFactor = ref(false)

function previewFactor(value: number) {
  draftFactor.value = value
  scale.previewFactor(value)
}

/** A typed factor hands back to the Move tool, as in Figma; a scrub or a preset stays. */
function commitFactor(value: number) {
  draftFactor.value = null
  scale.commitFactor(value)
  if (typingFactor.value) store.setTool('SELECT')
}

function cancelFactor() {
  draftFactor.value = null
  scale.cancel()
}

function pickPreset(value: unknown) {
  if (typeof value === 'number') scale.commitFactor(value)
}
</script>

<template>
  <PanelSection v-if="box" :label="tools.scale">
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
        :model-value="box.width"
        :min="MIN_RESCALE"
        @update:model-value="scale.previewSize('width', $event)"
        @commit="(value: number) => scale.commitSize('width', value)"
        @cancel="scale.cancel"
      />
      <NumberField
        icon="H"
        data-property="scale-height"
        :aria-label="panels.height"
        :model-value="box.height"
        :min="MIN_RESCALE"
        @update:model-value="scale.previewSize('height', $event)"
        @commit="(value: number) => scale.commitSize('height', value)"
        @cancel="scale.cancel"
      />
    </PanelGrid>
    <PanelGrid :columns="2" class="mt-1.5">
      <AppSelectRoot
        v-model:open="presetsOpen"
        :model-value="factor"
        @update:model-value="pickPreset"
      >
        <div ref="factorAnchor" class="min-w-0 self-start">
          <NumberField
            data-property="scale"
            :aria-label="panels.scaleMultiplier"
            :model-value="draftFactor ?? factor"
            :min="MIN_RESCALE"
            :step="0.01"
            :units="['x']"
            @editing-change="typingFactor = $event"
            @update:model-value="previewFactor"
            @commit="(value: number) => commitFactor(value)"
            @cancel="cancelFactor"
          >
            <template #icon>
              <icon-lucide-scaling class="size-3.5" />
            </template>
            <template #display="{ value }">
              <span class="min-w-0 flex-1 truncate text-surface">{{ value }}x</span>
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
          (primary, counter) => scale.setAnchor({ x: fractionOf(primary), y: fractionOf(counter) })
        "
      />
    </PanelGrid>
  </PanelSection>
</template>
