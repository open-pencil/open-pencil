<script setup lang="ts">
import { computed } from 'vue'

import type { ConnectorLineType, StrokeCap } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { lineType, startCap, endCap } = defineProps<{
  lineType: ConnectorLineType | null
  startCap: StrokeCap | null
  endCap: StrokeCap | null
}>()

const emit = defineEmits<{
  'update:lineType': [value: ConnectorLineType]
  'update:startCap': [value: StrokeCap]
  'update:endCap': [value: StrokeCap]
}>()

const { panels } = useI18n()

const lineOptions = computed<Array<{ value: ConnectorLineType; label: string }>>(() => [
  { value: 'ELBOWED', label: panels.value.connectorElbowed },
  { value: 'STRAIGHT', label: panels.value.connectorStraight },
  { value: 'CURVED', label: panels.value.connectorCurved }
])

/** The caps FigJam offers at a connector's ends. */
const capOptions = computed<Array<{ value: StrokeCap; label: string }>>(() => [
  { value: 'NONE', label: panels.value.strokeCapNone },
  { value: 'ARROW_LINES', label: panels.value.strokeCapArrowLines },
  { value: 'ARROW_EQUILATERAL', label: panels.value.strokeCapArrowEquilateral },
  { value: 'TRIANGLE_FILLED', label: panels.value.strokeCapTriangleFilled },
  { value: 'DIAMOND_FILLED', label: panels.value.strokeCapDiamondFilled },
  { value: 'CIRCLE_FILLED', label: panels.value.strokeCapCircleFilled }
])

const selectedLine = computed<ConnectorLineType>({
  get: () => lineType ?? 'ELBOWED',
  set: (value) => emit('update:lineType', value)
})
const selectedStart = computed<StrokeCap>({
  get: () => startCap ?? 'NONE',
  set: (value) => emit('update:startCap', value)
})
const selectedEnd = computed<StrokeCap>({
  get: () => endCap ?? 'NONE',
  set: (value) => emit('update:endCap', value)
})
</script>

<template>
  <div class="grid gap-2.5">
    <PanelFieldGroup :label="panels.connectorLine">
      <AppSelect
        v-model="selectedLine"
        :label="panels.connectorLine"
        :options="lineOptions"
        data-property="connector-line"
      />
    </PanelFieldGroup>
    <PanelFieldGroup :label="panels.connectorStart">
      <AppSelect
        v-model="selectedStart"
        :label="panels.connectorStart"
        :options="capOptions"
        data-property="connector-start-cap"
      />
    </PanelFieldGroup>
    <PanelFieldGroup :label="panels.connectorEnd">
      <AppSelect
        v-model="selectedEnd"
        :label="panels.connectorEnd"
        :options="capOptions"
        data-property="connector-end-cap"
      />
    </PanelFieldGroup>
  </div>
</template>
