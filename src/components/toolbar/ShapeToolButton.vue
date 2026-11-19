<script setup lang="ts">
import { ref } from 'vue'

import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'
import { useShapeWithText } from '@open-pencil/vue/controls/shape-with-text'
import { useToolMessages } from '@open-pencil/vue/i18n'
import { toolbarPopupSide } from '@open-pencil/vue/primitives/Toolbar'
import type { ToolbarAlign, ToolbarSide } from '@open-pencil/vue/primitives/Toolbar'
import { toolbarToolTestId } from '@open-pencil/vue/testing'

import { SHAPE_KIND_ICONS } from '@/components/icons/shapes'
import ShapeKindPicker from '@/components/shapes/ShapeKindPicker.vue'
import ToolButton from '@/components/toolbar/ToolButton.vue'
import type { ToolbarUI } from '@/components/toolbar/types'

/**
 * The shape-with-text tool: its button draws the kind picked last and opens the kinds to pick
 * from, and picking one arms the tool, as FigJam's Shapes panel does.
 */
const {
  ui,
  mobile = false,
  side = 'bottom',
  align = 'center'
} = defineProps<{
  ui?: ToolbarUI
  mobile?: boolean
  /** The canvas edge the toolbar is docked to; the picker opens away from it. */
  side?: ToolbarSide
  /** Where along its edge the toolbar sits; the picker lines up with the same end. */
  align?: ToolbarAlign
}>()
const tools = useToolMessages()
const { toolKind, toolActive, drawKind } = useShapeWithText()
const open = ref(false)

function pick(kind: ShapeWithTextType) {
  drawKind(kind)
  open.value = false
}
</script>

<template>
  <ShapeKindPicker
    v-model:open="open"
    :heading="tools.shape"
    :tooltip="tools.shape"
    :selected="toolKind"
    :side="toolbarPopupSide(side)"
    :tooltip-side="toolbarPopupSide(side)"
    :align="align"
    @select="pick"
  >
    <template #trigger>
      <ToolButton
        :data-test-id="toolbarToolTestId('SHAPE_WITH_TEXT', mobile)"
        :icon="SHAPE_KIND_ICONS[toolKind]"
        :label="tools.shape"
        :active="toolActive || open"
        :mobile="mobile"
        :ui="ui"
      />
    </template>
  </ShapeKindPicker>
</template>
