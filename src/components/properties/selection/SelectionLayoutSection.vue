<script setup lang="ts">
import {
  PositionControlsRoot,
  useEditorCommands,
  useI18n,
  useSelectionLayout
} from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import ClipContentControl from '@/components/properties/layout/ClipContentControl.vue'
import LayoutFlowControl from '@/components/properties/layout/LayoutFlowControl.vue'
import TextResizingControl from '@/components/properties/layout/TextResizingControl.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

/**
 * Layout of several selected layers, as in Figma: flow when all can hold an auto layout, resizing
 * for the text among them, their sizes, the spacing of a row or column, and clip content for
 * those that can clip.
 */
const layout = useSelectionLayout()
const { getCommand } = useEditorCommands()
const wrapInAutoLayout = getCommand('selection.wrapInAutoLayout')
const { panels } = useI18n()
</script>

<template>
  <PanelSection :label="panels.layout" data-test-id="selection-layout">
    <template #actions>
      <IconButton
        :label="wrapInAutoLayout.label"
        size="xs"
        :disabled="!wrapInAutoLayout.enabled.value"
        @click="wrapInAutoLayout.run()"
      >
        <icon-lucide-layout-panel-top class="size-3.5" />
      </IconButton>
    </template>

    <LayoutFlowControl v-if="layout.layoutMode.value !== undefined" class="mb-2" />
    <TextResizingControl v-if="layout.textResize.value !== undefined" />
    <div class="mt-2 mb-1 text-[11px] text-muted">{{ panels.dimensions }}</div>

    <PositionControlsRoot v-slot="{ wValue, hValue, actions }">
      <PanelGrid :columns="2">
        <Tip :label="panels.width">
          <NumberField
            icon="W"
            data-property="width"
            :aria-label="panels.width"
            :model-value="wValue"
            :min="1"
            @update:model-value="actions.updateProp('width', $event)"
            @commit="(v: number, p: number) => actions.commitProp('width', v, p)"
            @cancel="actions.cancelProp('width')"
          />
        </Tip>
        <Tip :label="panels.height">
          <NumberField
            icon="H"
            data-property="height"
            :aria-label="panels.height"
            :model-value="hValue"
            :min="1"
            @update:model-value="actions.updateProp('height', $event)"
            @commit="(v: number, p: number) => actions.commitProp('height', v, p)"
            @cancel="actions.cancelProp('height')"
          />
        </Tip>
      </PanelGrid>
    </PositionControlsRoot>

    <template v-if="layout.spacingAxis.value">
      <div class="mt-2 mb-1 text-[11px] text-muted">{{ panels.spacing }}</div>
      <PanelGrid :columns="2">
        <Tip :label="panels.spacing">
          <NumberField
            data-property="selection-spacing"
            :aria-label="panels.spacing"
            :model-value="layout.spacing.value"
            @update:model-value="layout.setSpacing($event)"
            @commit="layout.flushSpacing()"
          >
            <template #icon>
              <icon-lucide-move-horizontal
                v-if="layout.spacingAxis.value === 'horizontal'"
                class="size-3"
              />
              <icon-lucide-move-vertical v-else class="size-3" />
            </template>
          </NumberField>
        </Tip>
      </PanelGrid>
    </template>

    <ClipContentControl v-if="layout.clipsContent.value !== undefined" />
  </PanelSection>
</template>
