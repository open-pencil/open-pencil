<script setup lang="ts">
import { ChannelSliderRoot, ChannelSliderThumb, ChannelSliderTrack } from '@open-pencil/vue'

import type { ColorSliderUI } from '@/components/color-picker-panel/ui'
import NumberField from '@/components/inputs/NumberField.vue'
import { useColorSliderUI } from '@/components/color-picker-panel/ui'

interface OkhclChannelSliderProps {
  label: string
  modelValue: number
  min: number
  max: number
  step?: number
  displayValue: number
  displayMin: number
  displayMax: number
  displayStep?: number
  suffix?: string
  gradient?: string
  checkerboard?: boolean
  thumbFill?: string
  formatValueText?: (value: number) => string
  ui?: ColorSliderUI
}

const {
  label,
  modelValue,
  min,
  max,
  step = 1,
  displayValue,
  displayMin,
  displayMax,
  displayStep = 1,
  suffix,
  gradient,
  checkerboard = false,
  thumbFill = '#fff',
  formatValueText,
  ui
} = defineProps<OkhclChannelSliderProps>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  updateDisplay: [value: number]
}>()

const styles = useColorSliderUI(
  () => checkerboard,
  () => ui
)
</script>

<template>
  <div :class="styles.root.value">
    <span :class="styles.label.value">{{ label }}</span>
    <ChannelSliderRoot
      :class="styles.slider.value"
      :model-value="modelValue"
      :label="label"
      :min="min"
      :max="max"
      :step="step"
      :format-value-text="formatValueText"
      data-slot="slider"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <ChannelSliderTrack :class="styles.track.value" :style="gradient" />
      <ChannelSliderThumb :class="styles.thumb.value" :style="{ background: thumbFill }" />
    </ChannelSliderRoot>
    <NumberField
      :class="styles.input.value"
      :aria-label="label"
      :model-value="displayValue"
      :min="displayMin"
      :max="displayMax"
      :step="displayStep"
      :suffix="suffix"
      :ui="{ leading: 'hidden', field: 'pl-1.5', display: 'pl-1.5' }"
      @update:model-value="emit('updateDisplay', $event)"
    />
  </div>
</template>
