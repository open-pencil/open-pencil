<script setup lang="ts">
import { SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { ref } from 'vue'

import type { Fill, ImageFilters } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue/i18n'

import LeftToRight from '@/components/ui/direction/LeftToRight.vue'
import fillPickerTheme from '@/theme/fill-picker'

type Adjustment = keyof ImageFilters

/**
 * Figma's adjustments in its order. Its contrast slider moves the stored value, 0.3 of the plugin
 * API's, by 0.01 a step; the others move theirs by 0.01.
 */
const ADJUSTMENTS = [
  { key: 'exposure', label: 'imageExposure', step: 0.01 },
  { key: 'contrast', label: 'imageContrast', step: 0.01 / 0.3 },
  { key: 'saturation', label: 'imageSaturation', step: 0.01 },
  { key: 'temperature', label: 'imageTemperature', step: 0.01 },
  { key: 'tint', label: 'imageTint', step: 0.01 },
  { key: 'highlights', label: 'imageHighlights', step: 0.01 },
  { key: 'shadows', label: 'imageShadows', step: 0.01 }
] as const satisfies readonly { key: Adjustment; label: string; step: number }[]

/** A drag that ends this close to the middle lands on 0, as Figma's does; keys still step past it. */
const SNAP = 0.05

const { fill } = defineProps<{ fill: Fill }>()
const emit = defineEmits<{ update: [fill: Fill] }>()

const { panels } = useI18n()
const styles = tv(fillPickerTheme)

const dragging = ref(false)

function valueOf(key: Adjustment): number {
  return fill.filters?.[key] ?? 0
}

function set(key: Adjustment, value: number | undefined) {
  if (value === undefined) return
  const next = dragging.value && Math.abs(value) < SNAP ? 0 : value
  if (next === valueOf(key)) return
  emit('update', { ...fill, filters: { ...fill.filters, [key]: next } })
}

/**
 * Where `value` sits along the track, which reaches half a thumb past the slider at each end so
 * the thumb stays inside it while the pointer maps to the value across the slider, as Figma's does.
 */
function at(value: number): string {
  return `calc(0.4375rem + (100% - 0.875rem) * ${(value + 1) / 2})`
}

function rangeStyle(value: number) {
  return value < 0
    ? { left: at(value), right: '50%' }
    : { left: '50%', right: `calc(100% - ${at(value)})` }
}
</script>

<template>
  <div data-test-id="fill-picker-image-adjustments">
    <div v-for="adjustment in ADJUSTMENTS" :key="adjustment.key" :class="styles().adjustment()">
      <span :class="styles().adjustmentLabel()">{{ panels[adjustment.label] }}</span>
      <LeftToRight>
        <SliderRoot
          :class="styles().adjustmentSlider()"
          :model-value="[valueOf(adjustment.key)]"
          :min="-1"
          :max="1"
          :step="adjustment.step"
          thumb-alignment="overflow"
          :data-test-id="`fill-picker-${adjustment.key}`"
          @pointerdown="dragging = true"
          @value-commit="dragging = false"
          @update:model-value="(values) => set(adjustment.key, values?.[0])"
        >
          <SliderTrack :class="styles().adjustmentTrack()">
            <template v-if="valueOf(adjustment.key) !== 0">
              <span
                :class="styles().adjustmentRange()"
                :style="rangeStyle(valueOf(adjustment.key))"
              />
              <span :class="styles().adjustmentOrigin()" />
            </template>
          </SliderTrack>
          <SliderThumb
            :class="styles({ adjusted: valueOf(adjustment.key) !== 0 }).adjustmentThumb()"
            :aria-label="panels[adjustment.label]"
          />
        </SliderRoot>
      </LeftToRight>
    </div>
  </div>
</template>
