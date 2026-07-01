<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAppearance, useI18n } from '@open-pencil/vue'

import ScrubInput from '@/components/inputs/ScrubInput.vue'
import VariableScrubInput from '@/components/properties/VariableScrubInput.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelSection from '@/components/ui/PanelSection.vue'
import Tip from '@/components/ui/Tip.vue'

const { panels } = useI18n()
const {
  node,
  isMulti,
  active,
  hasCornerRadius,
  independentCorners,
  cornerRadiusValue,
  opacityPercent,
  visibilityState,
  updateProp,
  commitProp,
  toggleVisibility,
  toggleIndependentCorners,
  updateCornerProp,
  commitCornerProp
} = useAppearance()

const manualExpanded = ref<boolean | null>(null)

const showIndependentCorners = computed(() => {
  if (manualExpanded.value !== null) return manualExpanded.value
  if (independentCorners.value === true) return true
  const n = node.value
  if (!n) return false
  return !(
    n.topLeftRadius === n.topRightRadius &&
    n.topLeftRadius === n.bottomRightRadius &&
    n.topLeftRadius === n.bottomLeftRadius
  )
})

function onToggleCorners() {
  manualExpanded.value = !showIndependentCorners.value
  toggleIndependentCorners()
}
</script>

<template>
  <PanelSection v-if="active" :label="panels.appearance" data-test-id="appearance-section">
    <template #actions>
      <IconButton
        :label="panels.toggleVisibility"
        :active="visibilityState === 'hidden'"
        data-test-id="appearance-visibility"
        @click="toggleVisibility"
      >
        <icon-lucide-eye v-if="visibilityState === 'visible'" class="size-3.5" />
        <icon-lucide-eye-off v-else-if="visibilityState === 'hidden'" class="size-3.5" />
        <icon-lucide-eye v-else class="size-3.5 opacity-50" />
      </IconButton>
    </template>

    <div class="flex gap-1.5">
      <Tip :label="panels.opacity">
        <VariableScrubInput
          v-if="node"
          suffix="%"
          :model-value="opacityPercent"
          :min="0"
          :max="100"
          :node-id="node.id"
          binding-path="opacity"
          @update:model-value="updateProp('opacity', $event / 100)"
          @commit="(v: number, p: number) => commitProp('opacity', v / 100, p / 100)"
        >
          <template #icon>
            <icon-lucide-blend class="size-3" />
          </template>
        </VariableScrubInput>
        <ScrubInput
          v-else
          suffix="%"
          :model-value="opacityPercent"
          :min="0"
          :max="100"
          @update:model-value="updateProp('opacity', $event / 100)"
          @commit="(v: number, p: number) => commitProp('opacity', v / 100, p / 100)"
        >
          <template #icon>
            <icon-lucide-blend class="size-3" />
          </template>
        </ScrubInput>
      </Tip>

      <template v-if="hasCornerRadius">
        <Tip :label="panels.radius">
          <VariableScrubInput
            v-if="!showIndependentCorners && node"
            data-test-id="corner-radius-input"
            :model-value="cornerRadiusValue"
            :min="0"
            :node-id="node.id"
            binding-path="cornerRadius"
            @update:model-value="updateProp('cornerRadius', $event)"
            @commit="(v: number, p: number) => commitProp('cornerRadius', v, p)"
          >
            <template #icon>
              <icon-lucide-square-round-corner class="size-3" />
            </template>
          </VariableScrubInput>
          <ScrubInput
            v-else-if="!showIndependentCorners"
            data-test-id="corner-radius-input"
            :model-value="cornerRadiusValue"
            :min="0"
            @update:model-value="updateProp('cornerRadius', $event)"
            @commit="(v: number, p: number) => commitProp('cornerRadius', v, p)"
          >
            <template #icon>
              <icon-lucide-square-round-corner class="size-3" />
            </template>
          </ScrubInput>
        </Tip>

        <IconButton
          :label="panels.independentCornerRadii"
          size="md"
          class="size-[26px] shrink-0"
          :active="showIndependentCorners"
          data-test-id="independent-corners-toggle"
          @click="onToggleCorners"
        >
          <icon-lucide-square-round-corner class="size-3" />
        </IconButton>
      </template>
    </div>

    <div
      v-if="hasCornerRadius && showIndependentCorners && !isMulti && node"
      data-test-id="independent-corners-grid"
      class="mt-1.5 grid grid-cols-2 gap-1.5"
    >
      <VariableScrubInput
        data-test-id="corner-tl-input"
        label="TL"
        :model-value="node.topLeftRadius"
        :min="0"
        :node-id="node.id"
        binding-path="topLeftRadius"
        @update:model-value="updateCornerProp('topLeftRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('topLeftRadius', v, p)"
      />
      <VariableScrubInput
        data-test-id="corner-tr-input"
        label="TR"
        :model-value="node.topRightRadius"
        :min="0"
        :node-id="node.id"
        binding-path="topRightRadius"
        @update:model-value="updateCornerProp('topRightRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('topRightRadius', v, p)"
      />
      <VariableScrubInput
        data-test-id="corner-bl-input"
        label="BL"
        :model-value="node.bottomLeftRadius"
        :min="0"
        :node-id="node.id"
        binding-path="bottomLeftRadius"
        @update:model-value="updateCornerProp('bottomLeftRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('bottomLeftRadius', v, p)"
      />
      <VariableScrubInput
        data-test-id="corner-br-input"
        label="BR"
        :model-value="node.bottomRightRadius"
        :min="0"
        :node-id="node.id"
        binding-path="bottomRightRadius"
        @update:model-value="updateCornerProp('bottomRightRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('bottomRightRadius', v, p)"
      />
    </div>
  </PanelSection>
</template>
