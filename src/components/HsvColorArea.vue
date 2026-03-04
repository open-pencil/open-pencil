<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { colorToHexRaw, parseColor } from '@/engine/color'

import type { Color } from '@/types'

const props = defineProps<{
  color: Color
}>()

const emit = defineEmits<{
  update: [color: Color]
}>()

const hue = ref(0)
const saturation = ref(100)
const brightness = ref(100)
const alpha = ref(1)

function rgbToHsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  const s = max === 0 ? 0 : d / max
  const v = max

  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: s * 100, v: v * 100 }
}

function hsvToRgb(h: number, s: number, v: number) {
  s /= 100
  v /= 100
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0

  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]

  return { r: r + m, g: g + m, b: b + m }
}

watch(
  () => props.color,
  (c) => {
    const hsv = rgbToHsv(c.r, c.g, c.b)
    hue.value = hsv.h
    saturation.value = hsv.s
    brightness.value = hsv.v
    alpha.value = c.a
  },
  { immediate: true }
)

function emitColor() {
  const rgb = hsvToRgb(hue.value, saturation.value, brightness.value)
  emit('update', { r: rgb.r, g: rgb.g, b: rgb.b, a: alpha.value })
}

const hexValue = computed(() => colorToHexRaw(props.color))

function onHexInput(e: Event) {
  const input = (e.target as HTMLInputElement).value.replace('#', '')
  if (input.length !== 6) return
  const parsed = parseColor(`#${input}`)
  const color: Color = { ...parsed, a: alpha.value }
  emit('update', color)
}

const svAreaRef = ref<HTMLDivElement | null>(null)

function onSvPointerDown(e: PointerEvent) {
  const el = svAreaRef.value
  if (!el) return
  el.setPointerCapture(e.pointerId)
  updateSv(e)
}

function onSvPointerMove(e: PointerEvent) {
  const el = svAreaRef.value
  if (!el || !el.hasPointerCapture(e.pointerId)) return
  updateSv(e)
}

function updateSv(e: PointerEvent) {
  const el = svAreaRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  saturation.value = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
  brightness.value = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100))
  emitColor()
}

function onHueInput(e: Event) {
  hue.value = +(e.target as HTMLInputElement).value
  emitColor()
}

function onAlphaSliderInput(e: Event) {
  alpha.value = +(e.target as HTMLInputElement).value / 100
  emitColor()
}

function onAlphaNumberInput(e: Event) {
  alpha.value = Math.max(0, Math.min(1, +(e.target as HTMLInputElement).value / 100))
  emitColor()
}

const hueColor = computed(() => {
  const rgb = hsvToRgb(hue.value, 100, 100)
  return `rgb(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)})`
})
</script>

<template>
  <!-- SV area -->
  <div
    ref="svAreaRef"
    data-test-id="hsv-sv-area"
    class="relative h-[140px] w-full cursor-crosshair overflow-hidden rounded"
    :style="{ background: hueColor }"
    @pointerdown="onSvPointerDown"
    @pointermove="onSvPointerMove"
  >
    <div class="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
    <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
    <div
      class="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
      :style="{ left: `${saturation}%`, top: `${100 - brightness}%` }"
    />
  </div>

  <!-- Hue slider -->
  <div class="mt-2">
    <input
      type="range"
      data-test-id="hsv-hue-slider"
      class="hue-slider"
      :value="hue"
      min="0"
      max="360"
      @input="onHueInput"
    />
  </div>

  <!-- Alpha slider -->
  <div class="alpha-wrap mt-2">
    <div
      class="alpha-gradient"
      :style="{ background: `linear-gradient(to right, transparent, ${hueColor})` }"
    />
    <input
      type="range"
      data-test-id="hsv-alpha-slider"
      class="alpha-slider"
      :value="alpha * 100"
      min="0"
      max="100"
      @input="onAlphaSliderInput"
    />
  </div>

  <!-- Hex input -->
  <div class="mt-2 flex items-center gap-1">
    <span class="text-[11px] text-muted">#</span>
    <input
      type="text"
      data-test-id="hsv-hex-input"
      class="min-w-0 flex-1 rounded border border-border bg-input px-1.5 py-0.5 font-mono text-xs text-surface"
      :value="hexValue"
      maxlength="6"
      @change="onHexInput"
    />
    <input
      type="number"
      data-test-id="hsv-alpha-input"
      class="w-10 rounded border border-border bg-input px-1 py-0.5 text-right text-xs text-surface"
      :value="Math.round(alpha * 100)"
      min="0"
      max="100"
      @change="onAlphaNumberInput"
    />
    <span class="text-[11px] text-muted">%</span>
  </div>
</template>

<style scoped>
.hue-slider,
.alpha-slider {
  width: 100%;
  height: 12px;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 6px;
  outline: none;
}

.hue-slider {
  background: linear-gradient(
    to right,
    #f00 0%,
    #ff0 17%,
    #0f0 33%,
    #0ff 50%,
    #00f 67%,
    #f0f 83%,
    #f00 100%
  );
}

.alpha-wrap {
  position: relative;
  height: 12px;
  border-radius: 6px;
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

.alpha-gradient {
  position: absolute;
  inset: 0;
  border-radius: 6px;
}

.alpha-slider {
  position: absolute;
  inset: 0;
  background: transparent;
}

.hue-slider::-webkit-slider-thumb,
.alpha-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: white;
  border: 2px solid white;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
  cursor: pointer;
}
</style>
