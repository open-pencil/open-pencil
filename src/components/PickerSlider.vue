<script setup lang="ts">
import { inputNumberValue } from '@open-pencil/vue'
import { usePickerSliderUI } from './ui/picker-slider'

const {
  label,
  modelValue,
  min,
  max,
  step = 1,
  displayValue,
  displayMin,
  displayMax,
  displayStep,
  formatDisplay,
  parseDisplay,
  gradientStyle,
  checkerboard = false,
  thumbFill = '#fff',
  testId,
  ui
} = defineProps<{
  label: string
  modelValue: number
  min: number
  max: number
  step?: number
  displayValue?: number
  displayMin?: number
  displayMax?: number
  displayStep?: number
  formatDisplay?: (value: number) => string | number
  parseDisplay?: (value: number) => number
  gradientStyle?: string
  checkerboard?: boolean
  thumbFill?: string
  testId?: string
  ui?: Partial<
    Record<'root' | 'label' | 'track' | 'gradient' | 'range' | 'thumb' | 'input', string>
  >
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const cls = usePickerSliderUI({ checkerboard, ui })

function numberValue(): string | number {
  const value = displayValue ?? modelValue
  return formatDisplay ? formatDisplay(value) : value
}

function handleNumberChange(value: number) {
  emit('update:modelValue', parseDisplay ? parseDisplay(value) : value)
}

function thumbLeft(): string {
  const range = max - min
  const ratio = range === 0 ? 0 : (modelValue - min) / range
  const clampedRatio = Math.max(0, Math.min(1, ratio))
  return `calc(${clampedRatio * 100}% - ${clampedRatio * 14}px)`
}
</script>

<template>
  <div :class="cls.root" :data-test-id="testId">
    <span :class="cls.label">{{ label }}</span>
    <div :class="cls.track">
      <div :class="cls.gradient" :style="gradientStyle" />
      <input
        type="range"
        :class="cls.range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        @input="emit('update:modelValue', inputNumberValue($event))"
      />
      <div :class="cls.thumb" :style="{ left: thumbLeft(), background: thumbFill }" />
    </div>
    <input
      type="number"
      :class="cls.input"
      :min="displayMin ?? min"
      :max="displayMax ?? max"
      :step="displayStep ?? step"
      :value="numberValue()"
      @change="handleNumberChange(inputNumberValue($event))"
    />
  </div>
</template>
