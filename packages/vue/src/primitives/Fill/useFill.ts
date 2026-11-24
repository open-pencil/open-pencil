import { computed } from 'vue'
import type { Ref } from 'vue'

import type { Fill, GradientStop } from '@open-pencil/scene-graph'
import { DEFAULT_GRADIENT_TRANSFORM, defaultGradientStops } from '@open-pencil/scene-graph/gradient'
import type { Color } from '@open-pencil/scene-graph/primitives'

import {
  colorCSS,
  linearGradientCSS,
  SRGB_SPACES,
  useColorSpaces,
  type ColorSpaces
} from '#vue/controls/color-model/space'

import type { FillCategory } from './types'

const FILL_CATEGORY: Partial<Record<Fill['type'], FillCategory>> = {
  SOLID: 'SOLID',
  GRADIENT_LINEAR: 'GRADIENT',
  GRADIENT_RADIAL: 'GRADIENT',
  GRADIENT_ANGULAR: 'GRADIENT',
  GRADIENT_DIAMOND: 'GRADIENT',
  IMAGE: 'IMAGE'
}

function effectiveColor(color: Color, opacity: number): Color {
  return { ...color, a: color.a * opacity }
}

function gradientCSS(stops: GradientStop[], opacity: number, spaces: ColorSpaces): string {
  return linearGradientCSS(
    'to right',
    stops.map((stop) => ({ color: effectiveColor(stop.color, opacity), position: stop.position })),
    spaces
  )
}

export function fillCategory(fill: Fill): FillCategory {
  return FILL_CATEGORY[fill.type] ?? 'SOLID'
}

export function fillIsTransparent(fill: Fill): boolean {
  if (fill.opacity < 1) return true
  if (fillCategory(fill) === 'GRADIENT')
    return fill.gradientStops?.some((stop) => stop.color.a < 1) ?? fill.color.a < 1
  return fill.color.a < 1
}

/** A swatch's CSS background for `fill`, whose colors are stored and shown in `spaces`. */
export function fillSwatchBackground(fill: Fill, spaces: ColorSpaces = SRGB_SPACES): string {
  if (fillCategory(fill) === 'GRADIENT' && fill.gradientStops?.length) {
    return gradientCSS(fill.gradientStops, fill.opacity, spaces)
  }
  return colorCSS(effectiveColor(fill.color, fill.opacity), spaces)
}

/** Fill category state and immutable conversion actions without picker or popover behavior. */
export function useFill(fill: Ref<Fill>, onUpdate: (fill: Fill) => void) {
  const category = computed(() => fillCategory(fill.value))
  const spaces = useColorSpaces()
  const swatchBackground = computed(() => fillSwatchBackground(fill.value, spaces.value))
  const transparent = computed(() => fillIsTransparent(fill.value))

  function toSolid() {
    if (category.value === 'SOLID') return
    const color = fill.value.gradientStops?.[0]?.color ?? fill.value.color
    onUpdate({ ...fill.value, type: 'SOLID', color: { ...color } })
  }

  function toGradient() {
    if (category.value === 'GRADIENT') return
    const gradientStops = fill.value.gradientStops?.length
      ? structuredClone(fill.value.gradientStops)
      : defaultGradientStops(fill.value.color)
    onUpdate({
      ...fill.value,
      type: 'GRADIENT_LINEAR',
      gradientStops,
      gradientTransform: fill.value.gradientTransform ?? { ...DEFAULT_GRADIENT_TRANSFORM }
    })
  }

  function toImage() {
    if (category.value === 'IMAGE') return
    onUpdate({ ...fill.value, type: 'IMAGE' })
  }

  const actions = { toSolid, toGradient, toImage }

  return {
    category,
    swatchBackground,
    transparent,
    actions,
    toSolid,
    toGradient,
    toImage
  }
}
