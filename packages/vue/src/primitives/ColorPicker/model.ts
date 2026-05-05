import { convertToHsb, convertToHsl, convertToRgb } from 'reka-ui'
import type { Color as RekaColor, HSBColor, HSLColor, RGBColor } from 'reka-ui'

import { colorToCSS, okhclToRGBA, rgba255ToColor } from '@open-pencil/core/color'
import type { OkHCLColor } from '@open-pencil/core/color'
import type { Fill, Stroke } from '@open-pencil/core/scene-graph'
import type { Color } from '@open-pencil/core/types'

export interface ColorPickerModel {
  rekaColor: RekaColor
  rgb: RGBColor
  hsl: HSLColor
  hsb: HSBColor
}

export interface SliderPreviewModel {
  hue: Color
  hslSaturation: Color
  hslLightness: Color
  hsbSaturation: Color
  hsbBrightness: Color
}

export interface OkHCLSliderPreviewModel {
  okhclHue: Color
  okhclChroma: Color
  okhclLightness: Color
}

export interface SliderGradientModel {
  hslSaturation: string
  hslLightness: string
  hsbSaturation: string
  hsbBrightness: string
}

export interface OkHCLSliderGradientModel {
  okhclChroma: string
  okhclLightness: string
}

const OKHCL_CHROMA_MAX = 0.4
const OKHCL_LIGHTNESS_MID = 0.5
const OKHCL_HUE_PREVIEW_MIN_CHROMA = 0.15
const OKHCL_HUE_PREVIEW_FALLBACK_LIGHTNESS = 0.7

export function createColorPickerModel(color: Color): ColorPickerModel {
  const rekaColor = {
    space: 'rgb' as const,
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255),
    alpha: color.a
  }

  return {
    rekaColor,
    rgb: convertToRgb(rekaColor),
    hsl: convertToHsl(rekaColor),
    hsb: convertToHsb(rekaColor)
  }
}

export function rekaToAppColor(color: RekaColor): Color {
  const rgb = convertToRgb(color)
  return rgba255ToColor(rgb.r, rgb.g, rgb.b, rgb.alpha)
}

export function updateHue(model: ColorPickerModel, hue: number): Color {
  const nextSaturation = model.hsb.s === 0 ? 100 : model.hsb.s
  const nextBrightness = model.hsb.b === 0 ? 100 : model.hsb.b

  return rekaToAppColor({
    ...model.hsb,
    h: hue,
    s: nextSaturation,
    b: nextBrightness
  })
}

export function updateAlpha(color: Color, alpha: number): Color {
  return {
    ...color,
    a: clampUnit(alpha)
  }
}

export function updateRGBChannel(color: Color, channel: 'r' | 'g' | 'b', value255: number): Color {
  return {
    ...color,
    [channel]: clampUnit(value255 / 255)
  }
}

export function updateHSLChannel(
  model: ColorPickerModel,
  channel: 'h' | 's' | 'l',
  value: number
): Color {
  const next = {
    ...model.hsl,
    [channel]: channel === 'h' ? value : clampPercent(value)
  }

  if (channel === 's' && model.hsl.s === 0 && clampPercent(value) > 0) {
    next.h = model.hsl.h
    if (model.hsl.l >= 100) next.l = 50
    if (model.hsl.l <= 0) next.l = 50
  }

  return rekaToAppColor(next)
}

export function updateHSBChannel(
  model: ColorPickerModel,
  channel: 'h' | 's' | 'b',
  value: number
): Color {
  return rekaToAppColor({
    ...model.hsb,
    [channel]: channel === 'h' ? value : clampPercent(value)
  })
}

export function createSliderPreviewModel(model: ColorPickerModel): SliderPreviewModel {
  return {
    hue: rekaToAppColor({
      ...model.hsb,
      s: 100,
      b: 100
    }),
    hslSaturation: rekaToAppColor(model.hsl),
    hslLightness: rekaToAppColor(model.hsl),
    hsbSaturation: rekaToAppColor(model.hsb),
    hsbBrightness: rekaToAppColor(model.hsb)
  }
}

export function createOkHCLSliderPreviewModel(color: OkHCLColor): OkHCLSliderPreviewModel {
  return {
    okhclHue: okhclToRGBA({
      ...color,
      c: Math.max(color.c, OKHCL_HUE_PREVIEW_MIN_CHROMA),
      l: color.l <= 0 || color.l >= 1 ? OKHCL_HUE_PREVIEW_FALLBACK_LIGHTNESS : color.l
    }),
    okhclChroma: okhclToRGBA(color),
    okhclLightness: okhclToRGBA(color)
  }
}

export function createOkHCLSliderGradientModel(color: OkHCLColor): OkHCLSliderGradientModel {
  const lowChroma = okhclToRGBA({ ...color, c: 0 })
  const highChroma = okhclToRGBA({ ...color, c: OKHCL_CHROMA_MAX })
  const lowLightness = okhclToRGBA({ ...color, l: 0 })
  const midLightness = okhclToRGBA({ ...color, l: OKHCL_LIGHTNESS_MID })
  const highLightness = okhclToRGBA({ ...color, l: 1 })

  return {
    okhclChroma: `background: linear-gradient(to right, ${colorToCSS(lowChroma)}, ${colorToCSS(highChroma)});`,
    okhclLightness: `background: linear-gradient(to right, ${colorToCSS(lowLightness)}, ${colorToCSS(midLightness)}, ${colorToCSS(highLightness)});`
  }
}

export function createSliderGradientModel(model: ColorPickerModel): SliderGradientModel {
  const hslGray = rekaToAppColor({
    ...model.hsl,
    s: 0
  })
  const hslColor = rekaToAppColor({
    ...model.hsl,
    s: 100
  })
  const hslBlack = rekaToAppColor({
    ...model.hsl,
    l: 0
  })
  const hslMid = rekaToAppColor({
    ...model.hsl,
    l: 50
  })
  const hslWhite = rekaToAppColor({
    ...model.hsl,
    l: 100
  })
  const hsbGray = rekaToAppColor({
    ...model.hsb,
    s: 0
  })
  const hsbColor = rekaToAppColor({
    ...model.hsb,
    s: 100
  })
  const hsbBlack = rekaToAppColor({
    ...model.hsb,
    b: 0
  })
  const hsbBright = rekaToAppColor({
    ...model.hsb,
    b: 100
  })

  return {
    hslSaturation: `background: linear-gradient(to right, ${colorToCSS(hslGray)}, ${colorToCSS(hslColor)});`,
    hslLightness: `background: linear-gradient(to right, ${colorToCSS(hslBlack)}, ${colorToCSS(hslMid)}, ${colorToCSS(hslWhite)});`,
    hsbSaturation: `background: linear-gradient(to right, ${colorToCSS(hsbGray)}, ${colorToCSS(hsbColor)});`,
    hsbBrightness: `background: linear-gradient(to right, ${colorToCSS(hsbBlack)}, ${colorToCSS(hsbBright)});`
  }
}

export function toPercent(value: number): number {
  return Math.round(value * 100)
}

export function fromPercent(value: number): number {
  return clampUnit(value / 100)
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

export function applySolidFillColor(fill: Fill, color: Color): Fill {
  return {
    ...fill,
    color,
    opacity: color.a
  }
}

export function applySolidStrokeColor(color: Color): Partial<Stroke> {
  return {
    color,
    opacity: color.a
  }
}
