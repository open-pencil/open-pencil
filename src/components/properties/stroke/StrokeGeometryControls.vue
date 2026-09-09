<script setup lang="ts">
import { isStrokeCapValue, MIXED, useI18n, useStrokeControls } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

const controls = useStrokeControls()
const { cap, join, miterLimit } = controls
const { panels } = useI18n()
function setCap(value: string) {
  if (isStrokeCapValue(value)) controls.setCap(value)
}
function setJoin(value: string) {
  if (value === 'MITER' || value === 'BEVEL' || value === 'ROUND') controls.setJoin(value)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <PanelFieldGroup :label="panels.strokeCap">
      <SegmentedControl
        :model-value="cap === MIXED ? 'MIXED' : cap"
        :options="controls.capOptions"
        :label="panels.strokeCap"
        data-property="stroke-cap"
        @update:model-value="setCap"
      >
        <template #option="{ option }">
          <Tip :label="option.label">
            <icon-lucide-minus v-if="option.value === 'NONE'" class="size-3" />
            <icon-lucide-circle v-else-if="option.value === 'ROUND'" class="size-2.5" />
            <icon-lucide-square v-else-if="option.value === 'SQUARE'" class="size-2.5" />
            <icon-lucide-arrow-right v-else-if="option.value === 'ARROW_LINES'" class="size-3" />
            <icon-lucide-triangle v-else class="size-2.5" />
          </Tip>
        </template>
      </SegmentedControl>
    </PanelFieldGroup>
    <PanelFieldGroup :label="panels.strokeJoin">
      <SegmentedControl
        :model-value="join === MIXED ? 'MIXED' : join"
        :options="controls.joinOptions"
        :label="panels.strokeJoin"
        data-property="stroke-join"
        @update:model-value="setJoin"
      >
        <template #option="{ option }">
          <Tip :label="option.label">
            <icon-lucide-corner-up-right v-if="option.value === 'MITER'" class="size-3" />
            <icon-lucide-triangle v-else-if="option.value === 'BEVEL'" class="size-2.5" />
            <icon-lucide-circle v-else class="size-2.5" />
          </Tip>
        </template>
      </SegmentedControl>
    </PanelFieldGroup>
    <PanelFieldGroup :label="panels.strokeMiterLimit">
      <NumberField
        :model-value="miterLimit"
        :min="1"
        data-property="stroke-miter-limit"
        :aria-label="panels.strokeMiterLimit"
        @update:model-value="controls.updateMiterLimit"
        @commit="controls.commitMiterLimit"
      >
        <template #icon><icon-lucide-triangle-right class="size-3" /></template>
      </NumberField>
    </PanelFieldGroup>
  </div>
</template>
