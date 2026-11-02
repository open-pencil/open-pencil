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
  invert: 'Invert'
} as const

export const photoMessages = i18n('photo', photoMessageDefaults)
