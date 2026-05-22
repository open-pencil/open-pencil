import { computed, type Ref } from 'vue'

import { colorToCSS } from '@open-pencil/core/color'
import { BLACK } from '@open-pencil/core/constants'
import type { Fill, GradientFill, GradientStop } from '@open-pencil/core/scene-graph'

type FillCategory = 'SOLID' | 'GRADIENT' | 'IMAGE' | 'UNKNOWN'

const FILL_CATEGORY: Record<string, FillCategory> = {
  SOLID: 'SOLID',
  GRADIENT_LINEAR: 'GRADIENT',
  GRADIENT_RADIAL: 'GRADIENT',
  GRADIENT_ANGULAR: 'GRADIENT',
  GRADIENT_DIAMOND: 'GRADIENT',
  IMAGE: 'IMAGE'
}

function fillCategory(type: string): FillCategory {
  return FILL_CATEGORY[type] ?? 'UNKNOWN'
}

function gradientCSS(stops: GradientStop[]): string {
  return stops.map((s) => `${colorToCSS(s.color)} ${s.position * 100}%`).join(', ')
}

/**
 * Returns category and conversion helpers for a single fill value.
 *
 * This composable is useful for fill pickers that switch between solid,
 * gradient, and image modes while keeping a live fill model in sync.
 */
export function useFillPicker(fill: Ref<Fill>, onUpdate: (fill: Fill) => void) {
  const category = computed(() => fillCategory(fill.value.type))

  function toSolid() {
    if (fill.value.type === 'SOLID') return

    const color = fill.value.type.startsWith('GRADIENT')
      ? // eslint-disable-next-line typescript-eslint/no-unnecessary-condition
        (fill.value as GradientFill).gradientStops?.[0]?.color
      : undefined

    onUpdate({
      type: 'SOLID',
      color: color ? { ...color } : { ...BLACK },
      opacity: fill.value.opacity,
      visible: fill.value.visible,
      blendMode: fill.value.blendMode
    })
  }

  function toGradient() {
    if (fill.value.type.startsWith('GRADIENT')) return

    const current = fill.value

    const solidColor = current.type === 'SOLID' ? current.color : undefined

    const stops: GradientStop[] = [
      {
        color: solidColor ? { ...solidColor } : { ...BLACK },
        position: 0
      },
      { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
    ]

    onUpdate({
      type: 'GRADIENT_LINEAR',
      gradientStops: stops,
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 },
      opacity: current.opacity,
      visible: current.visible,
      blendMode: current.blendMode
    })
  }

  function toImage() {
    if (fill.value.type === 'IMAGE') return

    const current = fill.value

    onUpdate({
      type: 'IMAGE',
      imageHash: '',
      imageScaleMode: 'FILL',
      opacity: current.opacity,
      visible: current.visible,
      blendMode: current.blendMode
    })
  }

  const swatchBg = computed(() => {
    const current = fill.value
    if (current.type.startsWith('GRADIENT')) {
      // eslint-disable-next-line typescript-eslint/no-unnecessary-condition
      const stops = (current as GradientFill).gradientStops
      // eslint-disable-next-line typescript-eslint/no-unnecessary-condition
      if (stops?.length > 0) return `linear-gradient(to right, ${gradientCSS(stops)})`
    }
    if (current.type === 'SOLID') {
      // eslint-disable-next-line typescript-eslint/no-unnecessary-condition
      const color = current.color
      // eslint-disable-next-line typescript-eslint/no-unnecessary-condition
      if (color) return colorToCSS(color)
    }
    return ''
  })

  return {
    category,
    swatchBg,
    toSolid,
    toGradient,
    toImage
  }
}
