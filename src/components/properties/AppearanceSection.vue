<script setup lang="ts">
import { computed } from 'vue'

import type { BlendMode } from '@open-pencil/scene-graph'
import { POINT_COUNT_RANGE } from '@open-pencil/scene-graph/polygon'
import {
  SHAPE_WITH_TEXT_TYPES,
  isShapeWithTextType,
  type ShapeWithTextType
} from '@open-pencil/scene-graph/shape-with-text'
import { AppearanceControlsRoot, MIXED, useI18n, useVariableModes } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import { useBlendModeGroups } from '@/components/properties/blend-mode/use'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import PropertyBindButton from './component-properties/PropertyBindButton.vue'
import PropertyBoundField from './component-properties/PropertyBoundField.vue'
import VariableModeMenu from './variable-modes/VariableModeMenu.vue'
import VariableModeRows from './variable-modes/VariableModeRows.vue'

const { panels, shapes } = useI18n()
const variableModes = useVariableModes()
type BlendModeSelectValue = BlendMode | 'MIXED'

const baseBlendModeGroups = useBlendModeGroups(true)

/** The label each FigJam shape kind takes in the interface language. */
const SHAPE_KIND_LABELS = {
  SQUARE: 'square',
  ELLIPSE: 'ellipse',
  DIAMOND: 'diamond',
  TRIANGLE_UP: 'triangleUp',
  TRIANGLE_DOWN: 'triangleDown',
  ROUNDED_RECTANGLE: 'roundedRectangle',
  PARALLELOGRAM_RIGHT: 'parallelogramRight',
  PARALLELOGRAM_LEFT: 'parallelogramLeft',
  ENG_DATABASE: 'engDatabase',
  ENG_QUEUE: 'engQueue',
  ENG_FILE: 'engFile',
  ENG_FOLDER: 'engFolder',
  TRAPEZOID: 'trapezoid',
  PREDEFINED_PROCESS: 'predefinedProcess',
  SHIELD: 'shield',
  DOCUMENT_SINGLE: 'documentSingle',
  DOCUMENT_MULTIPLE: 'documentMultiple',
  MANUAL_INPUT: 'manualInput',
  HEXAGON: 'hexagon',
  CHEVRON: 'chevron',
  PENTAGON: 'pentagon',
  OCTAGON: 'octagon',
  STAR: 'star',
  PLUS: 'plus',
  ARROW_LEFT: 'arrowLeft',
  ARROW_RIGHT: 'arrowRight',
  SUMMING_JUNCTION: 'summingJunction',
  OR: 'or',
  SPEECH_BUBBLE: 'speechBubble',
  INTERNAL_STORAGE: 'internalStorage'
} as const satisfies Record<ShapeWithTextType, string>

const shapeKindOptions = computed(() =>
  SHAPE_WITH_TEXT_TYPES.map((kind) => ({
    value: kind,
    label: shapes.value[SHAPE_KIND_LABELS[kind]]
  }))
)

function blendModeGroups(value: BlendMode | typeof MIXED) {
  return value === MIXED
    ? [
        { options: [{ value: 'MIXED' as const, label: panels.value.mixed }] },
        ...baseBlendModeGroups.value
      ]
    : baseBlendModeGroups.value
}
</script>

<template>
  <AppearanceControlsRoot
    v-slot="{
      node,
      isMulti,
      active,
      hasCornerRadius,
      cornerRadiusDisabled,
      splitsCorners,
      hasPointCount,
      hasStarRatio,
      pointCount,
      hasShapeKind,
      shapeKind,
      starRatioPercent,
      showIndependentCorners,
      cornerRadiusValue,
      cornerRadiusBindingPaths,
      cornerSmoothingPercent,
      opacityPercent,
      blendModeValue,
      visibilityState,
      actions
    }"
  >
    <PanelSection v-if="active" :label="panels.appearance">
      <template #actions>
        <VariableModeMenu :choices="variableModes.choices.value" @set="variableModes.setMode" />
        <PropertyBindButton field="VISIBLE" />
        <IconButton
          :label="panels.toggleVisibility"
          :active="visibilityState === 'hidden'"
          @click="actions.toggleVisibility"
        >
          <icon-lucide-eye v-if="visibilityState === 'visible'" class="size-3.5" />
          <icon-lucide-eye-off v-else-if="visibilityState === 'hidden'" class="size-3.5" />
          <icon-lucide-eye v-else class="size-3.5 opacity-50" />
        </IconButton>
      </template>
      <PropertyBoundField field="VISIBLE" />

      <PanelGrid :columns="2" distribution="wide-first">
        <PanelFieldGroup :label="panels.blendMode">
          <AppSelect
            :model-value="blendModeValue === MIXED ? 'MIXED' : blendModeValue"
            class="w-full"
            :label="panels.blendMode"
            :groups="blendModeGroups(blendModeValue)"
            @update:model-value="
              (value: BlendModeSelectValue) => value !== 'MIXED' && actions.setBlendMode(value)
            "
          />
        </PanelFieldGroup>

        <PanelFieldGroup :label="panels.opacity">
          <VariableNumberField
            v-if="node && !isMulti"
            suffix="%"
            :aria-label="panels.opacity"
            :model-value="opacityPercent"
            :min="0"
            :max="100"
            :node-id="node.id"
            binding-path="opacity"
            @update:model-value="actions.updateProp('opacity', $event / 100)"
            @commit="(v: number, p: number) => actions.commitProp('opacity', v / 100, p / 100)"
          >
            <template #icon>
              <icon-lucide-blend class="size-3" />
            </template>
          </VariableNumberField>
          <NumberField
            v-else
            suffix="%"
            data-property="opacity"
            :aria-label="panels.opacity"
            :model-value="opacityPercent"
            :min="0"
            :max="100"
            @update:model-value="actions.updateProp('opacity', $event / 100)"
            @commit="(v: number, p: number) => actions.commitProp('opacity', v / 100, p / 100)"
          >
            <template #icon>
              <icon-lucide-blend class="size-3" />
            </template>
          </NumberField>
        </PanelFieldGroup>
      </PanelGrid>

      <PanelGrid v-if="hasCornerRadius && !showIndependentCorners" :columns="2" class="mt-1.5">
        <PanelFieldGroup :label="panels.radius">
          <VariableNumberField
            v-if="node && !isMulti"
            :aria-label="panels.radius"
            :model-value="cornerRadiusValue"
            :min="0"
            :node-id="node.id"
            binding-path="cornerRadius"
            :binding-paths="cornerRadiusBindingPaths"
            @update:model-value="actions.updateUniformRadius"
            @commit="actions.commitUniformRadius"
          >
            <template #icon>
              <icon-lucide-square-round-corner class="size-3" />
            </template>
          </VariableNumberField>
          <NumberField
            v-else
            data-property="cornerRadius"
            :aria-label="panels.radius"
            :model-value="cornerRadiusValue"
            :disabled="cornerRadiusDisabled"
            :min="0"
            @update:model-value="actions.updateUniformRadius"
            @commit="actions.commitUniformRadius"
          >
            <template #icon>
              <icon-lucide-square-round-corner class="size-3" />
            </template>
          </NumberField>
        </PanelFieldGroup>
        <div v-if="splitsCorners" class="flex h-6 items-center justify-end">
          <IconButton
            :label="panels.independentCornerRadii"
            size="xs"
            :active="showIndependentCorners"
            :disabled="cornerRadiusDisabled"
            @click="actions.toggleIndependentCorners"
          >
            <icon-lucide-square-round-corner class="size-3" />
          </IconButton>
        </div>
      </PanelGrid>

      <PanelGrid
        v-else-if="hasCornerRadius && !isMulti && node"
        :columns="2"
        class="mt-1.5 [&>[data-slot=actions]]:self-start"
        data-corner-grid
      >
        <VariableNumberField
          label="TL"
          :model-value="node.topLeftRadius"
          :min="0"
          :node-id="node.id"
          binding-path="topLeftRadius"
          @update:model-value="actions.updateCornerProp('topLeftRadius', $event)"
          @commit="(v: number, p: number) => actions.commitCornerProp('topLeftRadius', v, p)"
        />
        <VariableNumberField
          label="TR"
          :model-value="node.topRightRadius"
          :min="0"
          :node-id="node.id"
          binding-path="topRightRadius"
          @update:model-value="actions.updateCornerProp('topRightRadius', $event)"
          @commit="(v: number, p: number) => actions.commitCornerProp('topRightRadius', v, p)"
        />
        <VariableNumberField
          label="BL"
          :model-value="node.bottomLeftRadius"
          :min="0"
          :node-id="node.id"
          binding-path="bottomLeftRadius"
          @update:model-value="actions.updateCornerProp('bottomLeftRadius', $event)"
          @commit="(v: number, p: number) => actions.commitCornerProp('bottomLeftRadius', v, p)"
        />
        <VariableNumberField
          label="BR"
          :model-value="node.bottomRightRadius"
          :min="0"
          :node-id="node.id"
          binding-path="bottomRightRadius"
          @update:model-value="actions.updateCornerProp('bottomRightRadius', $event)"
          @commit="(v: number, p: number) => actions.commitCornerProp('bottomRightRadius', v, p)"
        />
        <template #actions>
          <IconButton
            :label="panels.independentCornerRadii"
            size="xs"
            active
            @click="actions.toggleIndependentCorners"
          >
            <icon-lucide-square-round-corner class="size-3" />
          </IconButton>
        </template>
      </PanelGrid>

      <PanelGrid v-if="hasShapeKind" :columns="1" class="mt-1.5">
        <PanelFieldGroup :label="shapes.kind">
          <AppSelect
            :model-value="shapeKind === MIXED ? '' : shapeKind"
            class="w-full"
            :label="shapes.kind"
            :options="shapeKindOptions"
            data-property="shapeWithTextType"
            @update:model-value="
              (value: string | number) => isShapeWithTextType(value) && actions.setShapeKind(value)
            "
          />
        </PanelFieldGroup>
      </PanelGrid>

      <PanelGrid v-if="hasPointCount" :columns="2" class="mt-1.5">
        <PanelFieldGroup :label="panels.pointCount">
          <NumberField
            :model-value="pointCount"
            :min="POINT_COUNT_RANGE.min"
            :max="POINT_COUNT_RANGE.max"
            :aria-label="panels.pointCount"
            data-property="pointCount"
            @update:model-value="actions.updateProp('pointCount', Math.round($event))"
            @commit="(v: number, p: number) => actions.commitProp('pointCount', Math.round(v), p)"
          >
            <template #icon>
              <icon-lucide-asterisk class="size-3" />
            </template>
          </NumberField>
        </PanelFieldGroup>
        <PanelFieldGroup v-if="hasStarRatio" :label="panels.starRatio">
          <NumberField
            suffix="%"
            :model-value="starRatioPercent"
            :min="0"
            :max="100"
            :step="0.1"
            :aria-label="panels.starRatio"
            data-property="starInnerRadius"
            @update:model-value="actions.updateProp('starInnerRadius', $event / 100)"
            @commit="
              (v: number, p: number) => actions.commitProp('starInnerRadius', v / 100, p / 100)
            "
          >
            <template #icon>
              <icon-lucide-star class="size-3" />
            </template>
          </NumberField>
        </PanelFieldGroup>
      </PanelGrid>

      <PanelGrid v-if="hasCornerRadius && !cornerRadiusDisabled" :columns="2" class="mt-1.5">
        <PanelFieldGroup :label="panels.cornerSmoothing">
          <NumberField
            suffix="%"
            :model-value="cornerSmoothingPercent"
            :min="0"
            :max="100"
            :aria-label="panels.cornerSmoothing"
            data-property="corner-smoothing"
            @update:model-value="actions.updateCornerProp('cornerSmoothing', $event / 100)"
            @commit="
              (v: number, p: number) =>
                actions.commitCornerProp('cornerSmoothing', v / 100, p / 100)
            "
          >
            <template #icon>
              <icon-lucide-squircle class="size-3" />
            </template>
          </NumberField>
        </PanelFieldGroup>
      </PanelGrid>

      <VariableModeRows :choices="variableModes.applied.value" @set="variableModes.setMode" />
    </PanelSection>
  </AppearanceControlsRoot>
</template>
