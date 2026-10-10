import { computed, ref, type Ref } from 'vue'

import type { Fill, GradientStop, GradientTransform } from '@open-pencil/scene-graph'
import { colorToCSS } from '@open-pencil/scene-graph/color'
import { DEFAULT_GRADIENT_TRANSFORM } from '@open-pencil/scene-graph/gradient'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { useColorModel } from '#vue/controls/color-model/use'

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

/**
 * Returns gradient-stop state and mutation helpers for a fill.
 *
 * Use this composable for gradient editors that need subtype switching,
 * active-stop selection, stop dragging, and stop color/opacity editing.
 */
export function useGradientStops(fill: Ref<Fill>, onUpdate: (fill: Fill) => void) {
  const activeStopIndex = ref(0)
  const stops = computed(() => fill.value.gradientStops ?? [])
  const subtype = computed(() => fill.value.type as GradientSubtype)

  const activeColor = computed(() => {
    const s = stops.value
    if (!s.length) return fill.value.color
    return s[Math.min(activeStopIndex.value, s.length - 1)].color
  })

  const barBackground = computed(() =>
    stops.value.length
      ? `linear-gradient(to right, ${stops.value.map((s) => `${colorToCSS(s.color)} ${s.position * 100}%`).join(', ')})`
      : ''
  )

  function emitStops(newStops: GradientStop[]) {
    onUpdate({ ...fill.value, gradientStops: newStops })
  }

  /** Figma keeps the transform across kinds, so a radial gradient grows from the linear line. */
  function setSubtype(type: GradientSubtype) {
    if (type === fill.value.type) return
    const gradientTransform: GradientTransform = fill.value.gradientTransform ?? {
      ...DEFAULT_GRADIENT_TRANSFORM
    }
    onUpdate({ ...fill.value, type, gradientTransform })
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
    selectStop(index)
    colorModel.updateHex(hex)
  }

  function updateStopOpacity(index: number, opacity: number) {
    const s = [...stops.value]
    s[index] = {
      ...s[index],
      color: { ...s[index].color, a: Math.max(0, Math.min(1, opacity / 100)) }
    }
    emitStops(s)
  }

  function updateActiveColor(color: Color) {
    const s = [...stops.value]
    const idx = Math.min(activeStopIndex.value, s.length - 1)
    s[idx] = { ...s[idx], color }
    emitStops(s)
  }

  const colorModel = useColorModel({
    color: activeColor,
    onUpdate: updateActiveColor
  })

  function dragStop(index: number, position: number) {
    const s = [...stops.value]
    s[index] = { ...s[index], position }
    emitStops(s)
  }

  return {
    activeStopIndex,
    stops,
    subtype,
    subtypes: SUBTYPES,
    activeColor,
    barBackground,
    setSubtype,
    selectStop,
    addStop,
    removeStop,
    updateStopPosition,
    updateStopColor,
    updateStopOpacity,
    updateActiveColor,
    dragStop
  }
}
