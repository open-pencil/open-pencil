<script setup lang="ts">
import { useConnector } from '@open-pencil/vue/controls/connector'
import { useMessages } from '@open-pencil/vue/i18n'

import PanelSection from '@/components/ui/panel/PanelSection.vue'

import ConnectorControls from './ConnectorControls.vue'

const panels = useMessages('panels')
const {
  active,
  lineType,
  startCap,
  endCap,
  color,
  thick,
  dashed,
  setLineType,
  setStartCap,
  setEndCap,
  setColor,
  setThick,
  setDashed
} = useConnector()
</script>

<template>
  <PanelSection v-if="active" :label="panels.connector">
    <ConnectorControls
      :line-type="lineType"
      :start-cap="startCap"
      :end-cap="endCap"
      :color="color"
      :thick="thick"
      :dashed="dashed"
      @update:line-type="setLineType"
      @update:start-cap="setStartCap"
      @update:end-cap="setEndCap"
      @update:color="setColor"
      @update:thick="setThick"
      @update:dashed="setDashed"
    />
  </PanelSection>
</template>
