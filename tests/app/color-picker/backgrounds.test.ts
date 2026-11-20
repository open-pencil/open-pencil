import { describe, expect, test } from 'bun:test'

import { convertColor } from '@open-pencil/scene-graph/color'

import {
  saturationBrightnessPixels,
  sliderTrackBackground
} from '@/components/color-picker-panel/backgrounds'

const SRGB = { stored: 'srgb', shown: 'srgb' } as const
const P3 = { stored: 'display-p3', shown: 'display-p3' } as const

describe('picker backgrounds in a color profile', () => {
  test('slider tracks are left to Reka in sRGB and drawn in P3 components otherwise', () => {
    const red = { space: 'rgb', r: 255, g: 0, b: 0, alpha: 1 } as const
    expect(sliderTrackBackground(red, 'hue', 'hsb', SRGB)).toBeUndefined()
    expect(sliderTrackBackground(red, 'hue', 'hsb', P3)).toBe(
      'linear-gradient(to right in display-p3, color(display-p3 1 0 0), color(display-p3 1 1 0), ' +
        'color(display-p3 0 1 0), color(display-p3 0 1 1), color(display-p3 0 0 1), ' +
        'color(display-p3 1 0 1), color(display-p3 1 0 0))'
    )
    expect(sliderTrackBackground(red, 'alpha', 'hsb', P3)).toStartWith(
      'linear-gradient(to right in display-p3, color(display-p3 1 0 0 / 0), color(display-p3 1 0 0)), '
    )
  })

  test('the area darkens in the stored components before clipping, as the canvas does', () => {
    const size = 3
    const pixels = saturationBrightnessPixels(0, { stored: 'display-p3', shown: 'srgb' }, size)
    // Full saturation at half brightness: the document's P3 (0.5, 0, 0), shown in sRGB.
    const expected = convertColor({ r: 0.5, g: 0, b: 0, a: 1 }, 'display-p3', 'srgb')
    const byte = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255)
    const at = (1 * size + 2) * 4
    expect([pixels?.[at], pixels?.[at + 1], pixels?.[at + 2]]).toEqual([
      byte(expected.r),
      byte(expected.g),
      byte(expected.b)
    ])
    // Darkening the clipped sRGB red would give 128 instead.
    expect(pixels?.[at]).toBeGreaterThan(130)
  })

  test('the area is drawn by Reka in sRGB and pixel by pixel otherwise', () => {
    expect(saturationBrightnessPixels(0, SRGB)).toBeUndefined()
    const pixels = saturationBrightnessPixels(0, P3, 2)
    // Top right: the full hue, P3 red, in P3.
    expect([pixels?.[4], pixels?.[5], pixels?.[6]]).toEqual([255, 0, 0])
  })
})
