<script setup lang="ts">
import { computed } from 'vue'

import type { Color } from '@open-pencil/scene-graph/primitives'
import { useVariableModes } from '@open-pencil/vue/controls/variable-modes'
import { useI18n } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import ColorPicker from '@/components/ColorPicker/ColorPicker.vue'
import PaintField from '@/components/inputs/PaintField.vue'
import PaintValue from '@/components/properties/paint/PaintValue.vue'
import FillSwatchTrigger from '@/components/ui/paint/FillSwatchTrigger.vue'
import { solidFill } from '@/components/ui/paint/swatch-trigger'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import VariableModeRows from './variable-modes/VariableModeRows.vue'

const editor = useEditorStore()
const pageColor = computed(() => editor.state.pageColor)
const pageFill = computed(() => solidFill(pageColor.value))
const { panels } = useI18n()
const variableModes = useVariableModes()

function updatePageAlpha(alpha: number) {
  editor.setPageColor({ ...pageColor.value, a: alpha })
}

function updatePageColor(color: Color) {
  editor.setPageColor(color)
}
</script>

<template>
  <PanelSection :label="panels.page">
    <PaintField
      :opacity="pageColor.a"
      :opacity-label="panels.opacity"
      @update:opacity="updatePageAlpha"
    >
      <template #preview>
        <ColorPicker :color="pageColor" @update="updatePageColor">
          <template #trigger>
            <FillSwatchTrigger :fill="pageFill" :label="panels.pageBackground" />
          </template>
        </ColorPicker>
      </template>
      <template #value>
        <PaintValue :color="pageColor" :label="panels.pageBackground" @update="updatePageColor" />
      </template>
    </PaintField>
    <VariableModeRows :choices="variableModes.choices.value" @set="variableModes.setMode" />
  </PanelSection>
</template>
