import { computed, type Ref } from 'vue'
import { colorToCSS } from '@open-pencil/core'

import type { Fill, GradientStop } from '@open-pencil/core'

type FillCategory = 'SOLID' | 'GRADIENT' | 'IMAGE'

const FILL_CATEGORY: Record<string, FillCategory> = {
  SOLID: 'SOLID',
  GRADIENT_LINEAR: 'GRADIENT',
  GRADIENT_RADIAL: 'GRADIENT',
  GRADIENT_ANGULAR: 'GRADIENT',
  GRADIENT_DIAMOND: 'GRADIENT',
  IMAGE: 'IMAGE'
}

function gradientCSS(stops: GradientStop[]): string {
  return stops.map((s) => `${colorToCSS(s.color)} ${s.position * 100}%`).join(', ')
}

export function useFillPicker(
  fill: Ref<Fill>,
  onUpdate: (fill: Fill) => void
) {
  const category = computed(() => FILL_CATEGORY[fill.value.type] ?? 'SOLID')

  function toSolid() {
    if (category.value === 'SOLID') return
    const color = fill.value.gradientStops?.[0]?.color ?? fill.value.color
    onUpdate({ ...fill.value, type: 'SOLID', color: { ...color } })
  }

  function toGradient() {
    if (category.value === 'GRADIENT') return
    const stops: GradientStop[] = fill.value.gradientStops?.length
      ? fill.value.gradientStops
      : [
          { color: { ...fill.value.color }, position: 0 },
          { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
        ]
    onUpdate({
      ...fill.value,
      type: 'GRADIENT_LINEAR',
      gradientStops: stops,
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 }
    })
  }

  function toImage() {
    if (category.value === 'IMAGE') return
    onUpdate({ ...fill.value, type: 'IMAGE' })
  }

  const swatchBg = computed(() => {
    if (category.value === 'GRADIENT' && fill.value.gradientStops?.length)
      return `linear-gradient(to right, ${gradientCSS(fill.value.gradientStops)})`
    return colorToCSS(fill.value.color)
  })

  return {
    category,
    swatchBg,
    toSolid,
    toGradient,
    toImage
  }
}
