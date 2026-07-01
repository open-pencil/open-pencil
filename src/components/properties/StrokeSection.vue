<script setup lang="ts">
import { ref } from 'vue'

import {
  applySolidStrokeColor,
  PropertyListRoot,
  useColorVariableBinding,
  useStrokeControls,
  useOkHCL,
  useI18n
} from '@open-pencil/vue'

import ColorStyleRow from '@/components/properties/ColorStyleRow.vue'
import { boundVariableColor } from '@/components/properties/color-style-row'
import AppSelect from '@/components/ui/AppSelect.vue'
import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelSection from '@/components/ui/PanelSection.vue'
import Tip from '@/components/ui/Tip.vue'

import type { Color, SceneNode, Stroke } from '@open-pencil/scene-graph'

const strokeCtx = useStrokeControls()
const strokeVarCtx = useColorVariableBinding('strokes')
const okhcl = useOkHCL()
const { panels } = useI18n()

const expandedSides = ref(false)

function updateStrokeColor(
  activeNode: SceneNode | null | undefined,
  index: number,
  color: Color,
  patch: (index: number, changes: Record<string, unknown>) => void
) {
  if (activeNode && strokeVarCtx.getBoundVariable(activeNode.id, index)) {
    strokeVarCtx.unbindVariable(activeNode.id, index)
  }
  patch(index, applySolidStrokeColor(color))
}

function onToggleSides(activeNode: SceneNode | null) {
  if (!activeNode) return
  const next = !expandedSides.value
  expandedSides.value = next
  if (next && !activeNode.independentStrokeWeights) {
    const weight = activeNode.strokes[0]?.weight ?? 1
    strokeCtx.selectSide('CUSTOM', {
      ...activeNode,
      borderTopWeight: weight,
      borderRightWeight: weight,
      borderBottomWeight: weight,
      borderLeftWeight: weight
    })
  } else if (!next && activeNode.independentStrokeWeights) {
    strokeCtx.selectSide('ALL', activeNode)
  }
}
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, actions }"
    prop-key="strokes"
    :label="panels.stroke"
  >
    <PanelSection :label="panels.stroke" data-test-id="stroke-section">
      <template #actions>
        <IconButton
          :label="panels.addStroke"
          data-test-id="stroke-section-add"
          @click="actions.add(strokeCtx.defaultStroke)"
        >
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </template>

      <p v-if="isMixed" class="text-[11px] text-muted">{{ panels.mixedStrokesHelp }}</p>

      <ColorStyleRow
        v-for="(stroke, i) in items"
        :key="`${i}:${stroke.visible ? 'visible' : 'hidden'}`"
        :item="stroke"
        :index="i"
        :active-node-id="activeNode?.id ?? null"
        :binding-api="strokeVarCtx"
        :variable-color="stroke.color"
        data-test-id="stroke-item"
        :data-test-index="i"
        :remove-label="panels.removeStroke"
        @patch="actions.patch(i, $event)"
        @toggle-visibility="actions.toggleVisibility(i)"
        @remove="actions.remove(i)"
      >
        <ColorInput
          class="min-w-0 flex-1"
          :color="
            activeNode
              ? (boundVariableColor(strokeVarCtx, activeNode.id, i) ?? stroke.color)
              : stroke.color
          "
          :okhcl="
            activeNode
              ? {
                  fieldFormat: okhcl.getFieldFormat(activeNode, i, 'stroke'),
                  fieldOptions: okhcl.fieldOptions,
                  okhcl: okhcl.getStrokeOkHCLColor(activeNode, i),
                  ...okhcl.getStrokePreviewInfo(activeNode, i),
                  setFieldFormat: ($event) => okhcl.setStrokeFieldFormat(activeNode, i, $event),
                  updateOkHCL: ($event) => okhcl.updateStrokeOkHCL(activeNode, i, $event)
                }
              : null
          "
          editable
          @update="updateStrokeColor(activeNode, i, $event, actions.patch)"
        />
      </ColorStyleRow>

      <div v-if="!isMixed && items.length > 0" class="mt-1 flex items-center gap-1.5">
        <AppSelect
          class="w-[72px]"
          :label="panels.strokeType"
          :model-value="strokeCtx.currentAlign(activeNode)"
          :options="strokeCtx.alignOptions"
          @update:model-value="strokeCtx.updateAlign($event as Stroke['align'], activeNode)"
        />
        <Tip :label="panels.strokeWeight">
          <ScrubInput
            v-if="!expandedSides"
            class="flex-1"
            icon="W"
            :model-value="items[0]?.weight ?? 1"
            :min="0"
            @update:model-value="actions.patch(0, { weight: $event })"
          />
        </Tip>
        <IconButton
          :label="panels.strokeSides"
          size="md"
          class="size-[26px] shrink-0"
          :active="expandedSides"
          data-test-id="stroke-sides-toggle"
          @click="onToggleSides(activeNode)"
        >
          <icon-lucide-layout-grid class="size-3.5" />
        </IconButton>
      </div>

      <div v-if="!isMixed && items.length > 0" class="mt-1.5 flex items-center gap-1.5">
        <IconButton
          :label="panels.strokeDash"
          size="md"
          class="shrink-0"
          :active="strokeCtx.dashState(items[0]).on"
          data-test-id="stroke-dash-toggle"
          @click="actions.patch(0, strokeCtx.toggleDash(items[0]))"
        >
          <span class="flex items-center gap-0.5">
            <icon-lucide-minus class="size-2.5" />
            <icon-lucide-minus class="size-2.5" />
          </span>
        </IconButton>
        <template v-if="strokeCtx.dashState(items[0]).on">
          <ScrubInput
            class="flex-1"
            icon="D"
            :model-value="items[0]?.dashPattern?.[0] ?? 6"
            :min="1"
            data-test-id="stroke-dash-length"
            @update:model-value="actions.patch(0, strokeCtx.setDash(items[0], $event))"
          />
          <ScrubInput
            class="flex-1"
            icon="G"
            :model-value="items[0]?.dashPattern?.[1] ?? items[0]?.dashPattern?.[0] ?? 6"
            :min="1"
            data-test-id="stroke-dash-gap"
            @update:model-value="actions.patch(0, strokeCtx.setGap(items[0], $event))"
          />
        </template>
      </div>

      <div
        v-if="!isMixed && items.length > 0 && expandedSides"
        class="mt-1.5 grid grid-cols-2 gap-1.5"
      >
        <ScrubInput
          v-for="side in strokeCtx.borderSides"
          :key="side"
          :label="side[0].toUpperCase()"
          :model-value="strokeCtx.borderWeight(activeNode, side)"
          :min="0"
          @update:model-value="strokeCtx.updateBorderWeight(side, $event, activeNode)"
        />
      </div>
    </PanelSection>
  </PropertyListRoot>
</template>
