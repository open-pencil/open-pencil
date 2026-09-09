<script setup lang="ts">
import type { Stroke } from '@open-pencil/scene-graph'
import { useI18n, useStrokeControls } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { stroke } = defineProps<{ stroke: Stroke }>()
const emit = defineEmits<{ patch: [changes: Partial<Stroke>] }>()
const controls = useStrokeControls()
const { panels } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-3 border-b border-border pb-3">
    <div class="flex items-center justify-between gap-2 text-xs text-surface">
      <span>{{ panels.strokeDash }}</span>
      <AppSwitch
        :label="panels.strokeDash"
        :model-value="controls.dashState(stroke).on"
        data-property="stroke-dash"
        @update:model-value="emit('patch', controls.toggleDash(stroke))"
      />
    </div>
    <div v-if="controls.dashState(stroke).on" class="grid grid-cols-2 gap-2">
      <PanelFieldGroup :label="panels.strokeDashLength">
        <NumberField
          :model-value="stroke.dashPattern?.[0] ?? 6"
          :min="1"
          :aria-label="panels.strokeDashLength"
          data-property="stroke-dash-length"
          @update:model-value="emit('patch', controls.setDash(stroke, $event))"
        />
      </PanelFieldGroup>
      <PanelFieldGroup :label="panels.strokeDashGap">
        <NumberField
          :model-value="stroke.dashPattern?.[1] ?? stroke.dashPattern?.[0] ?? 6"
          :min="1"
          :aria-label="panels.strokeDashGap"
          data-property="stroke-dash-gap"
          @update:model-value="emit('patch', controls.setGap(stroke, $event))"
        />
      </PanelFieldGroup>
    </div>
  </div>
</template>
