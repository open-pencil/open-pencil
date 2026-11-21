import { convertToHsb, convertToHsl, convertToRgb, getChannelRange, setChannelValue } from 'reka-ui'
import type { Color as RekaColor, ColorChannel, ColorSpace as RekaColorSpace } from 'reka-ui'

import { convertColor } from '@open-pencil/scene-graph/color'
import {
  isSRGB,
  linearGradientCSS,
  rekaToSceneColor,
  type ColorSpaces
} from '@open-pencil/vue/controls/color-model'

/**
 * Backgrounds for the picker's area and slider tracks when colors are stored or shown in a
 * profile other than sRGB: Reka writes them as sRGB CSS, which would not be the colors the canvas
 * draws for a Display P3 document.
 */

const HUES = [0, 60, 120, 180, 240, 300, 360]

/** The colors a slider of `channel` runs through, as Reka draws its track. */
function trackColors(color: RekaColor, channel: ColorChannel, model: RekaColorSpace): RekaColor[] {
  const opaque = { ...color, alpha: 1 }
  const hsl = convertToHsl(opaque)
  const hsb = convertToHsb(opaque)
  switch (channel) {
    case 'hue':
      return HUES.map((h) => ({ space: 'hsb', h, s: 100, b: 100, alpha: 1 }))
    case 'saturation': {
      const l = model === 'hsl' ? hsl.l : 50
      return [0, 100].map((s) => ({ ...hsl, s, l }))
    }
    case 'lightness':
      return [0, 50, 100].map((l) => ({ ...hsl, l }))
    case 'brightness':
      return [0, 100].map((b) => ({ ...hsb, b }))
    case 'alpha':
      return [0, 1].map((alpha) => ({ ...convertToRgb(color), alpha }))
    default: {
      const { min, max } = getChannelRange(channel)
      return [min, max].map((value) => setChannelValue(opaque, channel, value))
    }
  }
}

/**
 * A slider track's background, or `undefined` in sRGB, where Reka's own track is right. An alpha
 * track fades to transparent over the themed checkerboard its slider draws.
 */
export function sliderTrackBackground(
  color: RekaColor,
  channel: ColorChannel,
  model: RekaColorSpace,
  spaces: ColorSpaces
): string | undefined {
  if (isSRGB(spaces)) return undefined
  const stops = trackColors(color, channel, model).map((stop) => ({
    color: rekaToSceneColor(stop)
  }))
  return linearGradientCSS('to right', stops, spaces)
}

/** Pixels across and down that {@link saturationBrightnessPixels} draws; the browser smooths them. */
export const AREA_SIZE = 64

/**
 * The RGBA pixels, in `spaces.shown`, of a saturation-by-brightness area of hue `h`: each pixel
 * made from the stored components and converted as the canvas converts it, clipping where the
 * shown profile cannot show it. Layered CSS gradients would darken colors already clipped or
 * composited in another space. `undefined` in sRGB, where Reka's own area is right.
 */
export function saturationBrightnessPixels(
  h: number,
  spaces: ColorSpaces,
  size = AREA_SIZE
): Uint8ClampedArray<ArrayBuffer> | undefined {
  if (isSRGB(spaces)) return undefined
  const hue = rekaToSceneColor({ space: 'hsb', h, s: 100, b: 100, alpha: 1 })
  const pixels = new Uint8ClampedArray(size * size * 4)
  const last = Math.max(size - 1, 1)
  for (let row = 0; row < size; row++) {
    const brightness = 1 - row / last
    for (let column = 0; column < size; column++) {
      const saturation = column / last
      // HSB is linear in the stored components: white toward the hue, then scaled toward black.
      const channel = (full: number) => brightness * (1 - saturation + saturation * full)
      const stored = { r: channel(hue.r), g: channel(hue.g), b: channel(hue.b), a: 1 }
      const shown = convertColor(stored, spaces.stored, spaces.shown)
      const at = (row * size + column) * 4
      pixels[at] = shown.r * 255
      pixels[at + 1] = shown.g * 255
      pixels[at + 2] = shown.b * 255
      pixels[at + 3] = 255
    }
  }
  return pixels
}
