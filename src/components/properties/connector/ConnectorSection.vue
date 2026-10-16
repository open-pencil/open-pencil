<script setup lang="ts">
import { useConnector, useI18n } from '@open-pencil/vue'

import PanelSection from '@/components/ui/panel/PanelSection.vue'

import ConnectorControls from './ConnectorControls.vue'

const { panels } = useI18n()
const { active, lineType, startCap, endCap, setLineType, setStartCap, setEndCap } = useConnector()
</script>

<template>
  <PanelSection v-if="active" :label="panels.connector">
    <ConnectorControls
      :line-type="lineType"
      :start-cap="startCap"
      :end-cap="endCap"
      @update:line-type="setLineType"
      @update:start-cap="setStartCap"
      @update:end-cap="setEndCap"
    />
  </PanelSection>
</template>
