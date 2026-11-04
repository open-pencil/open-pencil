<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'
import IconCircleDashed from '~icons/lucide/circle-dashed'
import IconMinus from '~icons/lucide/minus'

import type { ConnectorLineType, StrokeCap } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import { figJamColor } from '@open-pencil/scene-graph/figjam'
import { generatedFrameText } from '@open-pencil/scene-graph/generated'
import { useConnector } from '@open-pencil/vue/controls/connector'
import { useFigJamMessages, useI18n } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { useConnectorOptions } from '@/components/figjam/connector/options'
import FigJamPalette from '@/components/figjam/FigJamPalette.vue'
import { CONNECTOR_LINE_TYPE_ICONS, connectorCapIcon } from '@/components/icons/connectors'
import IconButton from '@/components/ui/button/IconButton.vue'
import theme from '@/theme/figjam/toolbar'

import ToolbarMenu from './ToolbarMenu.vue'
import ToolbarOptions, { type ToolbarOption } from './ToolbarOptions.vue'

/** FigJam's connector toolbar: colour, line weight and dash, a label, its ends and its shape. */
const store = useEditorStore()
const connector = useConnector()
const figjam = useFigJamMessages()
const { panels } = useI18n()
const { lineOptions, capOptions } = useConnectorOptions()
const styles = tv(theme)()

const hex = computed(() =>
  connector.color.value ? colorToHex(figJamColor(connector.color.value)) : undefined
)
type Weight = 'thin' | 'thick'
type Dash = 'solid' | 'dashed'
const weightOptions = computed<ToolbarOption<Weight>[]>(() => [
  { value: 'thin', label: figjam.value.thin },
  { value: 'thick', label: panels.value.connectorThick }
])
const dashOptions = computed<ToolbarOption<Dash>[]>(() => [
  { value: 'solid', label: figjam.value.solid, icon: IconMinus },
  { value: 'dashed', label: panels.value.connectorDashed, icon: IconCircleDashed }
])
const lineTypeOptions = computed<ToolbarOption<ConnectorLineType>[]>(() =>
  lineOptions.value.map((option) => ({ ...option, icon: CONNECTOR_LINE_TYPE_ICONS[option.value] }))
)
function capMenu(end: 'start' | 'end') {
  return computed<ToolbarOption<StrokeCap>[]>(() =>
    capOptions.value.map((option) => ({ ...option, icon: connectorCapIcon(option.value, end) }))
  )
}
const startOptions = capMenu('start')
const endOptions = capMenu('end')
const lineType = computed(() => connector.lineType.value ?? 'ELBOWED')
const startCap = computed(() => connector.startCap.value ?? 'NONE')
const endCap = computed(() => connector.endCap.value ?? 'NONE')

/** Types into the connector's label, as FigJam's Add text does. */
function addText() {
  const [id] = store.state.selectedIds
  const node = id ? store.graph.getNode(id) : undefined
  const label = node && generatedFrameText(store.graph, node)
  if (!label) return
  store.startTextEditing(label.id)
  store.textEditor?.selectAll()
  store.textSelectionChanged()
}
</script>

<template>
  <ToolbarMenu :label="figjam.changeColor" property="toolbar-color">
    <template #trigger>
      <span :class="styles.dot()" :style="{ backgroundColor: hex }" />
    </template>
    <FigJamPalette
      :label="panels.connectorColor"
      :selected="connector.color.value"
      @select="connector.setColor($event)"
    />
  </ToolbarMenu>
  <ToolbarMenu :label="figjam.lineStyle" property="toolbar-line-style">
    <template #trigger>
      <icon-lucide-menu class="size-4" />
    </template>
    <div :class="styles.group()">
      <ToolbarOptions
        :label="figjam.lineStyle"
        :options="weightOptions"
        :selected="connector.thick.value ? 'thick' : 'thin'"
        @select="connector.setThick($event === 'thick')"
      />
      <ToolbarOptions
        :label="panels.connectorDashed"
        :options="dashOptions"
        :selected="connector.dashed.value ? 'dashed' : 'solid'"
        @select="connector.setDashed($event === 'dashed')"
      />
    </div>
  </ToolbarMenu>
  <span :class="styles.divider()" />
  <IconButton
    v-if="store.state.selectedIds.size === 1"
    size="md"
    :label="figjam.addText"
    data-property="toolbar-add-text"
    @click="addText"
  >
    <icon-lucide-type class="size-4" />
  </IconButton>
  <span :class="styles.divider()" />
  <ToolbarMenu :label="panels.connectorStart" property="toolbar-start-cap">
    <template #trigger>
      <component :is="connectorCapIcon(startCap, 'start')" class="size-4" />
    </template>
    <ToolbarOptions
      :label="panels.connectorStart"
      :options="startOptions"
      :selected="startCap"
      @select="connector.setStartCap($event)"
    />
  </ToolbarMenu>
  <ToolbarMenu :label="figjam.lineShape" property="toolbar-line-shape">
    <template #trigger>
      <component :is="CONNECTOR_LINE_TYPE_ICONS[lineType]" class="size-4" />
    </template>
    <ToolbarOptions
      :label="figjam.lineShape"
      :options="lineTypeOptions"
      :selected="lineType"
      @select="connector.setLineType($event)"
    />
  </ToolbarMenu>
  <ToolbarMenu :label="panels.connectorEnd" property="toolbar-end-cap">
    <template #trigger>
      <component :is="connectorCapIcon(endCap, 'end')" class="size-4" />
    </template>
    <ToolbarOptions
      :label="panels.connectorEnd"
      :options="endOptions"
      :selected="endCap"
      @select="connector.setEndCap($event)"
    />
  </ToolbarMenu>
</template>
