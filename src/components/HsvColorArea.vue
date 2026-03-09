<script setup lang="ts">
import { computed } from 'vue'
import {
  ColorAreaRoot,
  ColorAreaArea,
  ColorAreaThumb,
  ColorSliderRoot,
  ColorSliderTrack,
  ColorSliderThumb,
  ColorFieldRoot,
  ColorFieldInput,
  normalizeColor,
  convertToRgb,
  type Color as RekaColor
} from 'reka-ui'

import type { Color } from '@open-pencil/core'
import { colorToHex8, rgba255ToColor } from '@open-pencil/core'

const { color } = defineProps<{
  color: Color
}>()

const emit = defineEmits<{
  update: [color: Color]
}>()

const hexWithAlpha = computed(() => colorToHex8(color))

const rekaColor = computed(() => normalizeColor(hexWithAlpha.value))

function rekaToColor(c: RekaColor): Color {
  const rgb = convertToRgb(c)
  return rgba255ToColor(rgb.r, rgb.g, rgb.b, rgb.alpha)
}

function onRekaColorUpdate(c: RekaColor) {
  emit('update', rekaToColor(c))
}

function onHexUpdate(hex: string) {
  emit('update', rekaToColor(normalizeColor(hex)))
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <ColorAreaRoot
      v-slot="{ style }"
      :model-value="rekaColor"
      color-space="hsb"
      x-channel="saturation"
      y-channel="brightness"
      @update:color="onRekaColorUpdate"
    >
      <ColorAreaArea
        class="relative h-[140px] w-full cursor-crosshair overflow-hidden rounded"
        :style="style"
      >
        <ColorAreaThumb
          class="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
        />
      </ColorAreaArea>
    </ColorAreaRoot>

    <ColorSliderRoot
      :model-value="rekaColor"
      channel="hue"
      color-space="hsb"
      class="relative flex h-3 w-full items-center"
      @update:color="onRekaColorUpdate"
    >
      <ColorSliderTrack class="h-full w-full rounded-md" />
      <ColorSliderThumb
        class="absolute size-3.5 cursor-pointer rounded-full border-2 border-white shadow-sm"
      />
    </ColorSliderRoot>

    <div class="checkerboard relative h-3 w-full rounded-md">
      <ColorSliderRoot
        :model-value="rekaColor"
        channel="alpha"
        color-space="hsb"
        class="absolute inset-0 flex items-center"
        @update:color="onRekaColorUpdate"
      >
        <ColorSliderTrack class="h-full w-full rounded-md" />
        <ColorSliderThumb
          class="absolute size-3.5 cursor-pointer rounded-full border-2 border-white shadow-sm"
        />
      </ColorSliderRoot>
    </div>

    <div class="flex items-center gap-1">
      <span class="text-[11px] text-muted">#</span>
      <ColorFieldRoot
        :model-value="hexWithAlpha"
        class="min-w-0 flex-1"
        @update:model-value="onHexUpdate"
      >
        <ColorFieldInput
          class="w-full rounded border border-border bg-input px-1.5 py-0.5 font-mono text-xs text-surface"
        />
      </ColorFieldRoot>
      <input
        type="number"
        class="w-10 rounded border border-border bg-input px-1 py-0.5 text-right text-xs text-surface"
        :value="Math.round(color.a * 100)"
        min="0"
        max="100"
        @change="
          emit('update', {
            ...color,
            a: Math.max(0, Math.min(1, +($event.target as HTMLInputElement).value / 100))
          })
        "
      />
      <span class="text-[11px] text-muted">%</span>
    </div>
  </div>
</template>

<style scoped>
.checkerboard {
  background-image:
    linear-gradient(45deg, #444 25%, transparent 25%),
    linear-gradient(-45deg, #444 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #444 75%),
    linear-gradient(-45deg, transparent 75%, #444 75%);
  background-size: 8px 8px;
  background-position:
    0 0,
    0 4px,
    4px -4px,
    -4px 0;
  background-color: #333;
}
</style>
