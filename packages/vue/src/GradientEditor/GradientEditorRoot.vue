<script setup lang="ts">
import { computed, ref } from 'vue'
import { colorToCSS, parseColor } from '@open-pencil/core'

import type { Fill, GradientStop, GradientTransform } from '@open-pencil/core'

type GradientSubtype =
  | 'GRADIENT_LINEAR'
  | 'GRADIENT_RADIAL'
  | 'GRADIENT_ANGULAR'
  | 'GRADIENT_DIAMOND'

const SUBTYPES: { value: GradientSubtype; label: string }[] = [
  { value: 'GRADIENT_LINEAR', label: 'Linear' },
  { value: 'GRADIENT_RADIAL', label: 'Radial' },
  { value: 'GRADIENT_ANGULAR', label: 'Angular' },
  { value: 'GRADIENT_DIAMOND', label: 'Diamond' }
]

const DEFAULT_TRANSFORMS: Record<GradientSubtype, GradientTransform> = {
  GRADIENT_LINEAR: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 },
  GRADIENT_RADIAL: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
  GRADIENT_ANGULAR: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
  GRADIENT_DIAMOND: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 }
}

const { fill } = defineProps<{ fill: Fill }>()
const emit = defineEmits<{ update: [fill: Fill] }>()

const activeStopIndex = ref(0)
const stops = computed(() => fill.gradientStops ?? [])
const subtype = computed(() => fill.type as GradientSubtype)

const activeColor = computed(() => {
  const s = stops.value
  if (!s.length) return fill.color
  return s[Math.min(activeStopIndex.value, s.length - 1)].color
})

const barBackground = computed(() =>
  stops.value.length
    ? `linear-gradient(to right, ${stops.value.map((s) => `${colorToCSS(s.color)} ${s.position * 100}%`).join(', ')})`
    : ''
)

function emitStops(newStops: GradientStop[]) {
  emit('update', { ...fill, gradientStops: newStops })
}

function setSubtype(type: GradientSubtype) {
  if (type === fill.type) return
  emit('update', { ...fill, type, gradientTransform: DEFAULT_TRANSFORMS[type] })
}

function selectStop(index: number) {
  activeStopIndex.value = index
}

function addStop() {
  const s = [...stops.value]
  const pos = s.length >= 2 ? (s[s.length - 2].position + s[s.length - 1].position) / 2 : 0.5
  s.push({ color: { ...activeColor.value }, position: pos })
  s.sort((a, b) => a.position - b.position)
  activeStopIndex.value = s.findIndex((stop) => stop.position === pos)
  emitStops(s)
}

function removeStop(index: number) {
  if (stops.value.length <= 2) return
  emitStops(stops.value.filter((_, i) => i !== index))
  activeStopIndex.value = Math.min(activeStopIndex.value, stops.value.length - 2)
}

function updateStopPosition(index: number, position: number) {
  const s = [...stops.value]
  s[index] = { ...s[index], position: Math.max(0, Math.min(1, position / 100)) }
  emitStops(s)
}

function updateStopColor(index: number, hex: string) {
  const color = parseColor(hex.startsWith('#') ? hex : `#${hex}`)
  if (!color) return
  const s = [...stops.value]
  s[index] = { ...s[index], color: { ...color, a: s[index].color.a } }
  emitStops(s)
}

function updateStopOpacity(index: number, opacity: number) {
  const s = [...stops.value]
  s[index] = { ...s[index], color: { ...s[index].color, a: Math.max(0, Math.min(1, opacity / 100)) } }
  emitStops(s)
}

function onActiveColorUpdate(color: { r: number; g: number; b: number; a: number }) {
  const s = [...stops.value]
  const idx = Math.min(activeStopIndex.value, s.length - 1)
  s[idx] = { ...s[idx], color }
  emitStops(s)
}

function onStopDrag(index: number, position: number) {
  const s = [...stops.value]
  s[index] = { ...s[index], position }
  emitStops(s)
}
</script>

<template>
  <slot
    :stops="stops"
    :subtype="subtype"
    :subtypes="SUBTYPES"
    :active-stop-index="activeStopIndex"
    :active-color="activeColor"
    :bar-background="barBackground"
    :set-subtype="setSubtype"
    :select-stop="selectStop"
    :add-stop="addStop"
    :remove-stop="removeStop"
    :update-stop-position="updateStopPosition"
    :update-stop-color="updateStopColor"
    :update-stop-opacity="updateStopOpacity"
    :update-active-color="onActiveColorUpdate"
    :drag-stop="onStopDrag"
  />
</template>
