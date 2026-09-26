import type { Color as RekaColor } from 'reka-ui'
import type { MaybeRefOrGetter } from 'vue'

import type { OkHCLColor, RenderColorSpace } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

export type BuiltInColorFormat = 'hex' | 'rgb' | 'hsl' | 'hsb' | 'okhcl'
export type ColorFieldFormat = BuiltInColorFormat | (string & {})

export type RGBChannel = 'r' | 'g' | 'b'
export type HSLChannel = 'h' | 's' | 'l'
export type HSBChannel = 'h' | 's' | 'b'
export type OkHCLChannel = 'h' | 'c' | 'l' | 'a'

export interface ColorFieldOption {
  value: ColorFieldFormat
  label: string
}

export interface OkHCLControls {
  fieldFormat: ColorFieldFormat
  fieldOptions: ColorFieldOption[]
  okhcl: OkHCLColor | null
  previewColorSpace?: RenderColorSpace
  clipped?: boolean
  setFieldFormat: (format: ColorFieldFormat) => void
  updateOkHCL: (patch: Partial<OkHCLColor>) => void
}

export interface UseColorModelOptions {
  color: MaybeRefOrGetter<Color>
  okhcl?: MaybeRefOrGetter<OkHCLColor | null | undefined>
  format?: MaybeRefOrGetter<ColorFieldFormat | undefined>
  defaultFormat?: ColorFieldFormat
  onUpdate?: (color: Color) => void
  onUpdateOkHCL?: (patch: Partial<OkHCLColor>) => void
  onFormatChange?: (format: ColorFieldFormat) => void
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

export type RekaColorValue = RekaColor
