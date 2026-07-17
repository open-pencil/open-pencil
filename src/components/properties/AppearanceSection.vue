<script setup lang="ts">
import { AppearanceControlsRoot, MIXED, useI18n } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import { useBlendModeOptions } from '@/components/properties/blend-mode/use'
import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelRail from '@/components/ui/panel/PanelRail.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import type { BlendMode } from '@open-pencil/scene-graph'

const { panels } = useI18n()
type BlendModeSelectValue = BlendMode | 'MIXED'

const baseBlendModeOptions = useBlendModeOptions(true)

function blendModeOptions(value: BlendMode | typeof MIXED) {
  return value === MIXED
    ? [{ value: 'MIXED' as const, label: panels.value.mixed }, ...baseBlendModeOptions.value]
    : baseBlendModeOptions.value
}
</script>

<template>
  <AppearanceControlsRoot
    v-slot="{
      node,
      isMulti,
      active,
      hasCornerRadius,
      independentCorners,
      showIndependentCorners,
      cornerRadiusValue,
      cornerSmoothingPercent,
      opacityPercent,
      blendModeValue,
      visibilityState,
      actions
    }"
  >
    <PanelSection v-if="active" :label="panels.appearance">
      <template #actions>
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

      <PanelGrid columns="two">
        <PanelFieldGroup :label="panels.blendMode">
          <AppSelect
            :model-value="blendModeValue === MIXED ? 'MIXED' : blendModeValue"
            class="w-full"
            :label="panels.blendMode"
            :options="blendModeOptions(blendModeValue)"
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

      <PanelGrid
        v-if="hasCornerRadius && !showIndependentCorners"
        columns="fill-rail"
        class="mt-panel"
      >
        <PanelFieldGroup :label="panels.radius">
          <VariableNumberField
            v-if="node && !isMulti"
            :aria-label="panels.radius"
            :model-value="cornerRadiusValue"
            :min="0"
            :node-id="node.id"
            binding-path="cornerRadius"
            @update:model-value="actions.updateProp('cornerRadius', $event)"
            @commit="(v: number, p: number) => actions.commitProp('cornerRadius', v, p)"
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
            :min="0"
            @update:model-value="actions.updateProp('cornerRadius', $event)"
            @commit="(v: number, p: number) => actions.commitProp('cornerRadius', v, p)"
          >
            <template #icon>
              <icon-lucide-square-round-corner class="size-3" />
            </template>
          </NumberField>
        </PanelFieldGroup>
        <PanelRail>
          <IconButton
            :label="panels.independentCornerRadii"
            size="md"
            :active="independentCorners === true"
            @click="actions.toggleIndependentCorners"
          >
            <icon-lucide-square-round-corner class="size-3" />
          </IconButton>
        </PanelRail>
      </PanelGrid>

      <PanelGrid
        v-else-if="hasCornerRadius && !isMulti && node"
        columns="two-rail"
        class="mt-panel"
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
        <PanelRail>
          <IconButton
            :label="panels.independentCornerRadii"
            size="md"
            active
            @click="actions.toggleIndependentCorners"
          >
            <icon-lucide-square-round-corner class="size-3" />
          </IconButton>
        </PanelRail>
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
        <PanelRail />
      </PanelGrid>

      <PanelGrid v-if="hasCornerRadius" columns="fill" class="mt-panel">
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
    </PanelSection>
  </AppearanceControlsRoot>
</template>
