import { converter, formatCss, formatRgb, inGamut, toGamut } from 'culori'

import type { DocumentColorSpace, Fill, SceneNode, Stroke } from '#core/scene-graph'
import type { Color } from '#core/types'

import { normalizeColor } from './normalize'
import { getFillOkHCL, getStrokeOkHCL, type OkHCLColor } from './okhcl'

export type RenderColorSpace = 'srgb' | 'display-p3'
export type ColorIntentSpace = 'oklch' | 'srgb'

export interface ColorPreviewOptions {
  colorSpace?: RenderColorSpace
  documentColorSpace?: DocumentColorSpace
}

export interface ResolvedRenderColor {
  color: Color
  cssColor: string
  sourceSpace: ColorIntentSpace
  targetSpace: RenderColorSpace
  clipped: boolean
}

const DEFAULT_COLOR_SPACE: RenderColorSpace = 'display-p3'

const toRgb = converter('rgb')
const toP3 = converter('p3')
const toDisplayableRgb = toGamut('rgb', 'oklch')
const toDisplayableP3 = toGamut('p3', 'oklch')
const isDisplayableRgb = inGamut('rgb')
const isDisplayableP3 = inGamut('p3')

function normalizeOkLCH(color: OkHCLColor) {
  const hue = color.h % 360
  return {
    mode: 'oklch' as const,
    l: Math.max(0, Math.min(1, color.l)),
    c: Math.max(0, color.c),
    h: hue < 0 ? hue + 360 : hue,
    alpha: Math.max(0, Math.min(1, color.a ?? 1))
  }
}

function resolveTargetSpace(options?: ColorPreviewOptions): RenderColorSpace {
  return options?.colorSpace ?? options?.documentColorSpace ?? DEFAULT_COLOR_SPACE
}

function formatCssForTarget(color: Color, targetSpace: RenderColorSpace): string {
  if (targetSpace === 'display-p3') {
    const p3 = toP3({ mode: 'rgb', r: color.r, g: color.g, b: color.b, alpha: color.a })
    return formatCss({
      mode: 'p3',
      r: p3.r,
      g: p3.g,
      b: p3.b,
      alpha: p3.alpha ?? color.a
    })
  }

  return formatRgb({
    mode: 'rgb',
    r: color.r,
    g: color.g,
    b: color.b,
    alpha: color.a
  })
}

export function resolveOkHCLForPreview(
  color: OkHCLColor,
  options?: ColorPreviewOptions
): ResolvedRenderColor {
  const oklch = normalizeOkLCH(color)
  const targetSpace = resolveTargetSpace(options)

  if (targetSpace === 'display-p3') {
    const clipped = !isDisplayableP3(oklch)
    const p3 = toP3(toDisplayableP3(oklch))
    const rgb = toRgb({ mode: 'p3', r: p3.r, g: p3.g, b: p3.b, alpha: p3.alpha ?? oklch.alpha })
    const resolved = normalizeColor({
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
      a: rgb.alpha ?? oklch.alpha
    })

    return {
      color: resolved,
      cssColor: formatCss({
        mode: 'p3',
        r: p3.r,
        g: p3.g,
        b: p3.b,
        alpha: p3.alpha ?? oklch.alpha
      }),
      sourceSpace: 'oklch',
      targetSpace,
      clipped
    }
  }

  const clipped = !isDisplayableRgb(oklch)
  const rgb = toRgb(toDisplayableRgb(oklch))
  const resolved = normalizeColor({
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    a: rgb.alpha ?? oklch.alpha
  })

  return {
    color: resolved,
    cssColor: formatRgb({
      mode: 'rgb',
      r: resolved.r,
      g: resolved.g,
      b: resolved.b,
      alpha: resolved.a
    }),
    sourceSpace: 'oklch',
    targetSpace,
    clipped
  }
}

export function resolveRGBAForPreview(
  color: Color,
  options?: ColorPreviewOptions
): ResolvedRenderColor {
  const resolved = normalizeColor(color)
  const targetSpace = resolveTargetSpace(options)
  return {
    color: resolved,
    cssColor: formatCssForTarget(resolved, targetSpace),
    sourceSpace: 'srgb',
    targetSpace,
    clipped: false
  }
}

export function resolveNodeFillColor(
  fill: Fill,
  fillIndex: number,
  node: SceneNode,
  options?: ColorPreviewOptions
): ResolvedRenderColor {
  const okhcl = getFillOkHCL(node, fillIndex)?.color
  if (okhcl) return resolveOkHCLForPreview(okhcl, options)
  return resolveRGBAForPreview(fill.color, options)
}

export function resolveNodeStrokeColor(
  stroke: Stroke,
  strokeIndex: number,
  node: SceneNode,
  options?: ColorPreviewOptions
): ResolvedRenderColor {
  const okhcl = getStrokeOkHCL(node, strokeIndex)?.color
  if (okhcl) return resolveOkHCLForPreview(okhcl, options)
  return resolveRGBAForPreview(stroke.color, options)
}

export function colorToDisplayCss(color: Color, options?: ColorPreviewOptions): string {
  return resolveRGBAForPreview(color, options).cssColor
}

export function getDefaultRenderColorSpace(): RenderColorSpace {
  return DEFAULT_COLOR_SPACE
}
