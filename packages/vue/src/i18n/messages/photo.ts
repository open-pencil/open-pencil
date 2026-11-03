import { i18n } from '#vue/i18n/create'

/** Photo editing: image adjustments, and the pixel tools that follow. */
export const photoMessageDefaults = {
  adjustments: 'Adjustments',
  reset: 'Reset',
  exposure: 'Exposure',
  contrast: 'Contrast',
  brightness: 'Brightness',
  saturation: 'Saturation',
  vibrance: 'Vibrance',
  temperature: 'Temperature',
  tint: 'Tint',
  highlights: 'Highlights',
  shadows: 'Shadows',
  hue: 'Hue',
  invert: 'Invert',
  levels: 'Levels',
  blackPoint: 'Black point',
  whitePoint: 'White point',
  midtones: 'Midtones',
  curve: 'Curve',
  resetCurve: 'Reset curve'
} as const

export const photoMessages = i18n('photo', photoMessageDefaults)
