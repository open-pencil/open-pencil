<script setup lang="ts">
import { useShapeWithText } from '@open-pencil/vue/controls/shape-with-text'
import { useShapeMessages } from '@open-pencil/vue/i18n'

import PanelSection from '@/components/ui/panel/PanelSection.vue'

import ShapeWithTextControls from './ShapeWithTextControls.vue'

const shapes = useShapeMessages()
const {
  active,
  kind,
  color,
  fillMode,
  lineStyle,
  lineColor,
  textSize,
  typeface,
  labelFont,
  setKind,
  setColor,
  setFillMode,
  setLineStyle,
  setLineColor,
  setTextSize,
  setTypeface
} = useShapeWithText()
</script>

<template>
  <PanelSection v-if="active && kind && fillMode && lineStyle" :label="shapes.kind">
    <ShapeWithTextControls
      :kind="kind"
      :color="color"
      :fill-mode="fillMode"
      :line-style="lineStyle"
      :line-color="lineColor"
      :text-size="textSize"
      :typeface="typeface"
      :label-font="labelFont ?? undefined"
      @update:kind="setKind"
      @update:color="setColor"
      @update:fill-mode="setFillMode"
      @update:line-style="setLineStyle"
      @update:line-color="setLineColor"
      @update:text-size="setTextSize"
      @update:typeface="setTypeface"
    />
  </PanelSection>
</template>
