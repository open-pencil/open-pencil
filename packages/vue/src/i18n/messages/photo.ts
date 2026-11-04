import { params } from '@nanostores/i18n'

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
  sharpen: 'Sharpen',
  noise: 'Grain',
  vignette: 'Vignette',
  invert: 'Invert',
  levels: 'Levels',
  blackPoint: 'Black point',
  whitePoint: 'White point',
  midtones: 'Midtones',
  curve: 'Curve',
  resetCurve: 'Reset curve',
  removeBackground: 'Remove background',
  removingBackground: 'Removing background… The first time downloads the model (about 45 MB).',
  backgroundRemoved: 'Background removed.',
  removeBackgroundFailed: params('Could not remove the background: {error}')
} as const

export const photoMessages = i18n('photo', photoMessageDefaults)
