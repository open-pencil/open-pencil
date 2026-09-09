<script setup lang="ts">
import { SliderRoot } from 'reka-ui'
import { computed } from 'vue'

import { provideChannelSlider } from '#vue/primitives/ChannelSlider/context'
import type {
  ChannelSliderRootProps,
  ChannelSliderRootSlotProps
} from '#vue/primitives/ChannelSlider/types'

/**
 * Scalar color-channel slider used for OkHCL until Reka supports that color space.
 *
 * @deprecated-when-upstream Replace with Reka ColorSlider after
 * https://github.com/unovue/reka-ui/issues/2798 lands.
 */
const {
  modelValue,
  label,
  as = 'span',
  asChild = false,
  min = 0,
  max = 100,
  step = 1,
  orientation = 'horizontal',
  disabled = false,
  inverted = false,
  formatValueText = String
} = defineProps<ChannelSliderRootProps>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  valueCommit: [value: number]
}>()

defineSlots<{
  default?: (props: ChannelSliderRootSlotProps) => unknown
}>()

defineOptions({ inheritAttrs: false })

const sliderValue = computed({
  get: () => [modelValue],
  set: (values: number[]) => emit('update:modelValue', values[0] ?? min)
})
const value = computed(() => modelValue)
const labelRef = computed(() => label)
const minRef = computed(() => min)
const maxRef = computed(() => max)
const stepRef = computed(() => step)
const disabledRef = computed(() => disabled)
const orientationRef = computed(() => orientation)
const valueText = computed(() => formatValueText(modelValue))
const slotProps = computed<ChannelSliderRootSlotProps>(() => ({
  value: value.value,
  min: minRef.value,
  max: maxRef.value,
  step: stepRef.value,
  disabled: disabledRef.value,
  orientation: orientationRef.value
}))

provideChannelSlider({
  value,
  label: labelRef,
  valueText,
  min: minRef,
  max: maxRef,
  step: stepRef,
  disabled: disabledRef,
  orientation: orientationRef
})

function commit(values: number[]) {
  emit('valueCommit', values[0] ?? min)
}
</script>

<template>
  <SliderRoot
    v-bind="$attrs"
    v-model="sliderValue"
    :as="as"
    :as-child="asChild"
    :min="min"
    :max="max"
    :step="step"
    :orientation="orientation"
    :disabled="disabled"
    :inverted="inverted"
    data-slot="root"
    @value-commit="commit"
  >
    <slot v-bind="slotProps" />
  </SliderRoot>
</template>
