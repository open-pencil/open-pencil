<script setup lang="ts">
import { ColorSliderRoot, ColorSliderThumb, ColorSliderTrack } from 'reka-ui'
import type { Color as RekaColor, ColorChannel, ColorSpace } from 'reka-ui'
import { computed } from 'vue'

import { useColorSpaces } from '@open-pencil/vue/controls/color-model'

import { sliderTrackBackground } from '@/components/color-picker-panel/backgrounds'
import type { ColorSliderUI } from '@/components/color-picker-panel/ui'
import { useColorSliderUI } from '@/components/color-picker-panel/ui'
import NumberField from '@/components/inputs/NumberField.vue'
import LeftToRight from '@/components/ui/direction/LeftToRight.vue'

interface StandardColorSliderProps {
  label: string
  /** Only the slider, labelled for assistive technology, as Figma's hue and alpha are. */
  bare?: boolean
  modelValue: RekaColor
  channel: ColorChannel
  colorSpace?: ColorSpace
  step?: number
  numberValue?: number
  numberMin?: number
  numberMax?: number
  numberStep?: number
  suffix?: string
  checkerboard?: boolean
  thumbFill?: string
  ui?: ColorSliderUI
}

const {
  label,
  bare = false,
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

const spaces = useColorSpaces()
// Reka writes its track in sRGB; in another profile the track shows the colors the canvas draws.
const trackBackground = computed(() =>
  sliderTrackBackground(modelValue, channel, colorSpace, spaces.value)
)

const styles = useColorSliderUI(
  () => checkerboard,
  () => ui
)
</script>

<template>
  <div :class="styles.root.value">
    <span v-if="!bare" :class="styles.label.value">{{ label }}</span>
    <LeftToRight>
      <ColorSliderRoot
        :class="styles.slider.value"
        :model-value="modelValue"
        :channel="channel"
        :color-space="colorSpace"
        :step="step"
        data-slot="slider"
        @update:color="emit('update', $event)"
      >
        <ColorSliderTrack
          :class="styles.track.value"
          :style="trackBackground ? { background: trackBackground } : undefined"
        />
        <ColorSliderThumb
          :class="styles.thumb.value"
          :aria-label="label"
          :style="{ background: thumbFill }"
        />
      </ColorSliderRoot>
    </LeftToRight>
    <NumberField
      v-if="!bare && numberValue !== undefined"
      :class="styles.input.value"
      :aria-label="label"
      :model-value="numberValue"
      :min="numberMin"
      :max="numberMax"
      :step="numberStep"
      :suffix="suffix"
      :ui="{ leading: 'hidden', field: 'ps-1.5', display: 'ps-1.5' }"
      @update:model-value="emit('updateNumber', $event)"
    />
  </div>
</template>
