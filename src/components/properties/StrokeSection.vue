<script setup lang="ts">
import { ref } from 'vue'

import {
  applySolidStrokeColor,
  BindableValueRoot,
  MIXED,
  useColorBindingProvider,
  useI18n,
  useOkHCL,
  useStrokeControls
} from '@open-pencil/vue'

import ColorPicker from '@/components/ColorPicker/ColorPicker.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import PropertyItemRow from '@/components/properties/item-list/PropertyItemRow.vue'
import PaintField from '@/components/properties/paint/PaintField.vue'
import PaintValue from '@/components/properties/paint/PaintValue.vue'
import {
  applyPaintMutation,
  cancelPaintMutation,
  commitPaintMutation,
  paintBindingTargets
} from '@/components/properties/paint/binding'
import { createStrokeOkhclAdapter } from '@/components/properties/paint/okhcl'
import PropertyListRoot from '@/components/properties/PropertyListRoot.vue'
import SharedStyleField from '@/components/properties/shared-style/SharedStyleField.vue'
import VariableBindingPicker from '@/components/properties/binding/VariableBindingPicker.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import FillSwatch from '@/components/ui/FillSwatch.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import Tip from '@/components/ui/Tip.vue'

import { colorToHexRaw } from '@open-pencil/core/color'
import type { Color, Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { BindableValueActions } from '@open-pencil/vue'

const strokeCtx = useStrokeControls()
const { advancedActive, cap, join, miterLimit } = strokeCtx
const colorProvider = useColorBindingProvider()
const okhcl = useOkHCL()
const { panels, dialogs } = useI18n()
const expandedSides = ref(false)

function strokePreview(stroke: Stroke, color: Color): Fill {
  return {
    type: 'SOLID',
    color,
    opacity: stroke.opacity,
    visible: stroke.visible
  }
}

function updateStrokeColor(
  binding: BindableValueActions<Color>,
  flush: () => void,
  color: Color,
  patch: (changes: Partial<Stroke>) => void,
  commit: boolean
) {
  if (!applyPaintMutation(binding, flush, () => patch(applySolidStrokeColor(color)))) return
  if (commit) commitPaintMutation(binding)
}

function setCap(value: string) {
  if (value === 'NONE' || value === 'ROUND' || value === 'SQUARE') {
    strokeCtx.setCap(value)
  }
}

function setJoin(value: string) {
  if (value === 'MITER' || value === 'BEVEL' || value === 'ROUND') {
    strokeCtx.setJoin(value)
  }
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
    v-slot="{ items, isMixed, activeNode, selectedNodeIds, flush, actions }"
    prop-key="strokes"
    :label="panels.stroke"
  >
    <PanelSection :label="panels.stroke" :empty="!isMixed && items.length === 0">
      <template #actions>
        <IconButton :label="panels.addStroke" @click="actions.add(strokeCtx.defaultStroke)">
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </template>

      <SharedStyleField kind="stroke" :label="panels.strokeStyle" />

      <p v-if="isMixed" class="text-[11px] text-muted">{{ panels.mixedStrokesHelp }}</p>

      <PropertyItemRow
        v-for="(stroke, index) in items"
        :key="`${index}:${stroke.visible ? 'visible' : 'hidden'}`"
        prop-key="strokes"
        :index="index"
        :visibility-label="panels.toggleVisibility"
        :remove-label="panels.removeStroke"
      >
        <BindableValueRoot
          v-slot="binding"
          :provider="colorProvider"
          :targets="paintBindingTargets(selectedNodeIds, 'strokes', index)"
          :value="stroke.color"
          batch-label="Change stroke color"
        >
          <PaintField
            :opacity="stroke.opacity"
            :opacity-label="panels.opacity"
            @update:opacity="actions.patch(index, { opacity: $event })"
          >
            <template #preview>
              <ColorPicker
                :color="binding.resolvedValue ?? stroke.color"
                :okhcl="createStrokeOkhclAdapter(okhcl, activeNode, index)"
                @update="
                  updateStrokeColor(
                    binding.actions,
                    flush,
                    $event,
                    (changes) => actions.patch(index, changes),
                    false
                  )
                "
                @open-change="!$event && commitPaintMutation(binding.actions)"
                @cancel="cancelPaintMutation(binding.actions)"
              >
                <template #trigger>
                  <button
                    type="button"
                    :aria-label="panels.stroke"
                    class="size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                  >
                    <FillSwatch
                      :fill="strokePreview(stroke, binding.resolvedValue ?? stroke.color)"
                      class="size-full"
                    />
                  </button>
                </template>
              </ColorPicker>
            </template>

            <template #value>
              <PaintValue
                :color="stroke.color"
                :resolved-color="binding.resolvedValue"
                :variable-name="binding.variable?.name"
                :label="panels.stroke"
                @update="
                  updateStrokeColor(
                    binding.actions,
                    flush,
                    $event,
                    (changes) => actions.patch(index, changes),
                    true
                  )
                "
              />
            </template>

            <template #binding>
              <VariableBindingPicker
                :trigger-label="panels.applyVariable"
                :search-placeholder="dialogs.search"
                :empty-label="panels.noVariablesFound"
                :detach-label="panels.detachVariable"
                :create-label="
                  panels.createColorVariable({ value: `#${colorToHexRaw(stroke.color)}` })
                "
                :create-name-placeholder="panels.variableName"
                :create-submit-label="panels.create"
              />
            </template>
          </PaintField>
        </BindableValueRoot>
      </PropertyItemRow>

      <div v-if="!isMixed && items.length > 0" class="mt-1 flex items-center gap-1.5">
        <AppSelect
          :label="panels.strokeType"
          :ui="{ trigger: 'w-[88px] flex-none' }"
          :model-value="strokeCtx.currentAlign(activeNode)"
          :options="strokeCtx.alignOptions"
          data-property="stroke-align"
          @update:model-value="strokeCtx.updateAlign($event as Stroke['align'], activeNode)"
        />
        <Tip :label="panels.strokeWeight">
          <NumberField
            v-if="!expandedSides"
            class="flex-1"
            icon="W"
            :model-value="items[0]?.weight ?? 1"
            :min="0"
            data-property="stroke-weight"
            @update:model-value="actions.patch(0, { weight: $event })"
          />
        </Tip>
        <IconButton
          :label="panels.strokeSides"
          size="md"
          class="size-[26px] shrink-0"
          :active="expandedSides"
          data-property="stroke-sides"
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
          data-property="stroke-dash"
          @click="actions.patch(0, strokeCtx.toggleDash(items[0]))"
        >
          <span class="flex items-center gap-0.5">
            <icon-lucide-minus class="size-2.5" />
            <icon-lucide-minus class="size-2.5" />
          </span>
        </IconButton>
        <template v-if="strokeCtx.dashState(items[0]).on">
          <NumberField
            class="flex-1"
            icon="D"
            :model-value="items[0]?.dashPattern?.[0] ?? 6"
            :min="1"
            data-property="stroke-dash-length"
            @update:model-value="actions.patch(0, strokeCtx.setDash(items[0], $event))"
          />
          <NumberField
            class="flex-1"
            icon="G"
            :model-value="items[0]?.dashPattern?.[1] ?? items[0]?.dashPattern?.[0] ?? 6"
            :min="1"
            data-property="stroke-dash-gap"
            @update:model-value="actions.patch(0, strokeCtx.setGap(items[0], $event))"
          />
        </template>
      </div>

      <PanelGrid v-if="advancedActive" columns="three" class="mt-1.5">
        <PanelFieldGroup :label="panels.strokeCap">
          <SegmentedControl
            :model-value="cap === MIXED ? 'MIXED' : cap"
            :options="strokeCtx.capOptions"
            :label="panels.strokeCap"
            data-property="stroke-cap"
            @update:model-value="setCap"
          >
            <template #option="{ option }">
              <Tip :label="option.label">
                <icon-lucide-minus v-if="option.value === 'NONE'" class="size-3" />
                <icon-lucide-circle v-else-if="option.value === 'ROUND'" class="size-2.5" />
                <icon-lucide-square v-else class="size-2.5" />
              </Tip>
            </template>
          </SegmentedControl>
        </PanelFieldGroup>

        <PanelFieldGroup :label="panels.strokeJoin">
          <SegmentedControl
            :model-value="join === MIXED ? 'MIXED' : join"
            :options="strokeCtx.joinOptions"
            :label="panels.strokeJoin"
            data-property="stroke-join"
            @update:model-value="setJoin"
          >
            <template #option="{ option }">
              <Tip :label="option.label">
                <icon-lucide-corner-up-right v-if="option.value === 'MITER'" class="size-3" />
                <icon-lucide-triangle v-else-if="option.value === 'BEVEL'" class="size-2.5" />
                <icon-lucide-circle v-else class="size-2.5" />
              </Tip>
            </template>
          </SegmentedControl>
        </PanelFieldGroup>

        <PanelFieldGroup :label="panels.strokeMiterLimit">
          <NumberField
            :model-value="miterLimit"
            :min="1"
            data-property="stroke-miter-limit"
            :aria-label="panels.strokeMiterLimit"
            @update:model-value="strokeCtx.updateMiterLimit"
            @commit="strokeCtx.commitMiterLimit"
          >
            <template #icon>
              <icon-lucide-triangle-right class="size-3" />
            </template>
          </NumberField>
        </PanelFieldGroup>
      </PanelGrid>

      <div
        v-if="!isMixed && items.length > 0 && expandedSides"
        class="mt-1.5 grid grid-cols-2 gap-1.5"
      >
        <NumberField
          v-for="side in strokeCtx.borderSides"
          :key="side"
          :label="side[0].toUpperCase()"
          :model-value="strokeCtx.borderWeight(activeNode, side)"
          :min="0"
          :data-property="`stroke-${side}-weight`"
          @update:model-value="strokeCtx.updateBorderWeight(side, $event, activeNode)"
        />
      </div>
    </PanelSection>
  </PropertyListRoot>
</template>
