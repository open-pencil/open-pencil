<script setup lang="ts">
import { ColorSliderRoot, ColorSliderThumb, ColorSliderTrack } from 'reka-ui'

import type { Color as RekaColor, ColorChannel, ColorSpace } from 'reka-ui'
import type { ColorSliderUI } from '@/components/color-picker-panel/ui'
import NumberField from '@/components/inputs/NumberField.vue'
import { useColorSliderUI } from '@/components/color-picker-panel/ui'

interface StandardColorSliderProps {
  label: string
  modelValue: RekaColor
  channel: ColorChannel
  colorSpace?: ColorSpace
  step?: number
  numberValue: number
  numberMin: number
  numberMax: number
  numberStep?: number
  suffix?: string
  checkerboard?: boolean
  thumbFill?: string
  ui?: ColorSliderUI
}

const {
  label,
  modelValue,
  channel,
  colorSpace = 'hsl',
  step,
  numberValue,
  numberMin,
  numberMax,
  numberStep = 1,
  suffix,
  checkerboard = false,
  thumbFill = '#fff',
  ui
} = defineProps<StandardColorSliderProps>()

const emit = defineEmits<{
  update: [color: RekaColor]
  updateNumber: [value: number]
}>()

const styles = useColorSliderUI(
  () => checkerboard,
  () => ui
)
</script>

<template>
  <div :class="styles.root.value">
    <span :class="styles.label.value">{{ label }}</span>
    <ColorSliderRoot
      :class="styles.slider.value"
      :model-value="modelValue"
      :channel="channel"
      :color-space="colorSpace"
      :step="step"
      data-slot="slider"
      @update:color="emit('update', $event)"
    >
      <ColorSliderTrack :class="styles.track.value" />
      <ColorSliderThumb :class="styles.thumb.value" :style="{ background: thumbFill }" />
    </ColorSliderRoot>
    <NumberField
      :class="styles.input.value"
      :aria-label="label"
      :model-value="numberValue"
      :min="numberMin"
      :max="numberMax"
      :step="numberStep"
      :suffix="suffix"
      :ui="{ leading: 'hidden', field: 'pl-1.5', display: 'pl-1.5' }"
      @update:model-value="emit('updateNumber', $event)"
    />
  </div>
</template>
