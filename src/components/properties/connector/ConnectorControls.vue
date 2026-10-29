<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { ConnectorLineType, StrokeCap } from '@open-pencil/scene-graph'
import type { FigJamColorName } from '@open-pencil/scene-graph/figjam'
import { useI18n } from '@open-pencil/vue/i18n'

import FigJamPalette from '@/components/figjam/FigJamPalette.vue'
import { CONNECTOR_LINE_TYPE_ICONS, connectorCapIcon } from '@/components/icons/connectors'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import theme from '@/theme/figjam/controls'

/**
 * A connector's line, as FigJam's selection toolbar sets it: its colour from FigJam's palette,
 * Thick and Dashed as toggles, its line type, and the caps at its ends.
 */
const {
  lineType,
  startCap,
  endCap,
  color = null,
  thick = false,
  dashed = false
} = defineProps<{
  lineType: ConnectorLineType | null
  startCap: StrokeCap | null
  endCap: StrokeCap | null
  color?: FigJamColorName | null
  thick?: boolean
  dashed?: boolean
}>()

const emit = defineEmits<{
  'update:lineType': [value: ConnectorLineType]
  'update:startCap': [value: StrokeCap]
  'update:endCap': [value: StrokeCap]
  'update:color': [value: FigJamColorName]
  'update:thick': [value: boolean]
  'update:dashed': [value: boolean]
}>()

const { panels } = useI18n()
const styles = tv(theme)()

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
  <div :class="styles.root()">
    <div>
      <div :class="styles.header()">
        <span :class="styles.label()">{{ panels.connectorColor }}</span>
        <div class="flex items-center gap-0.5">
          <IconButton
            toggle
            :label="panels.connectorThick"
            :active="thick"
            data-property="connector-thick"
            @click="emit('update:thick', !thick)"
          >
            <icon-lucide-minus class="size-3.5 [stroke-width:4]" />
          </IconButton>
          <IconButton
            toggle
            :label="panels.connectorDashed"
            :active="dashed"
            data-property="connector-dashed"
            @click="emit('update:dashed', !dashed)"
          >
            <icon-lucide-circle-dashed class="size-3.5" />
          </IconButton>
        </div>
      </div>
      <FigJamPalette
        :label="panels.connectorColor"
        :selected="color"
        @select="emit('update:color', $event)"
      />
    </div>
    <PanelFieldGroup :label="panels.connectorLine">
      <AppSelect
        v-model="selectedLine"
        :label="panels.connectorLine"
        :options="lineOptions"
        data-property="connector-line"
      >
        <template #leading>
          <component :is="CONNECTOR_LINE_TYPE_ICONS[selectedLine]" :class="styles.leadingIcon()" />
        </template>
        <template #option="{ option }">
          <span :class="styles.option()">
            <component :is="CONNECTOR_LINE_TYPE_ICONS[option.value]" :class="styles.optionIcon()" />
            {{ option.label }}
          </span>
        </template>
      </AppSelect>
    </PanelFieldGroup>
    <PanelFieldGroup :label="panels.connectorStart">
      <AppSelect
        v-model="selectedStart"
        :label="panels.connectorStart"
        :options="capOptions"
        data-property="connector-start-cap"
      >
        <template #leading>
          <component :is="connectorCapIcon(selectedStart, 'start')" :class="styles.leadingIcon()" />
        </template>
        <template #option="{ option }">
          <span :class="styles.option()">
            <component :is="connectorCapIcon(option.value, 'start')" :class="styles.optionIcon()" />
            {{ option.label }}
          </span>
        </template>
      </AppSelect>
    </PanelFieldGroup>
    <PanelFieldGroup :label="panels.connectorEnd">
      <AppSelect
        v-model="selectedEnd"
        :label="panels.connectorEnd"
        :options="capOptions"
        data-property="connector-end-cap"
      >
        <template #leading>
          <component :is="connectorCapIcon(selectedEnd, 'end')" :class="styles.leadingIcon()" />
        </template>
        <template #option="{ option }">
          <span :class="styles.option()">
            <component :is="connectorCapIcon(option.value, 'end')" :class="styles.optionIcon()" />
            {{ option.label }}
          </span>
        </template>
      </AppSelect>
    </PanelFieldGroup>
  </div>
</template>
