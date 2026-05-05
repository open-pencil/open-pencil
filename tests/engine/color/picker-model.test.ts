import { describe, expect, test } from 'bun:test'

import {
  createColorPickerModel,
  fromPercent,
  toPercent,
  updateAlpha,
  updateHSBChannel,
  updateHSLChannel,
  updateHue,
  updateRGBChannel
} from '@open-pencil/vue'

import type { Color } from '@open-pencil/core'

describe('color picker model', () => {
  const base: Color = { r: 0.4, g: 0.2, b: 0.6, a: 0.75 }

  test('updates hue from the shared slider', () => {
    const model = createColorPickerModel(base)
    const updated = updateHue(model, 180)
    expect(updated).not.toEqual(base)
    expect(updated.a).toBeCloseTo(base.a, 5)
  })

  test('updates hue from grayscale colors without staying neutral', () => {
    const grayscale: Color = { r: 1, g: 1, b: 1, a: 1 }
    const updated = updateHue(createColorPickerModel(grayscale), 220)
    expect(updated.r === updated.g && updated.g === updated.b).toBe(false)
  })

  test('updates alpha independently', () => {
    const updated = updateAlpha(base, 0.25)
    expect(updated.a).toBeCloseTo(0.25, 5)
    expect(updated.r).toBeCloseTo(base.r, 5)
  })

  test('updates rgb channels in 0-255 space', () => {
    const updated = updateRGBChannel(base, 'r', 255)
    expect(updated.r).toBeCloseTo(1, 5)
    expect(updated.g).toBeCloseTo(base.g, 5)
  })

  test('updates hsl normalized channels smoothly', () => {
    const model = createColorPickerModel(base)
    const updated = updateHSLChannel(model, 's', 12.3)
    expect(updated.a).toBeCloseTo(base.a, 5)
    expect(updated).not.toEqual(base)
  })

  test('updates hsl saturation from grayscale colors without staying neutral', () => {
    const grayscale: Color = { r: 1, g: 1, b: 1, a: 1 }
    const updated = updateHSLChannel(createColorPickerModel(grayscale), 's', 40)
    expect(updated.r === updated.g && updated.g === updated.b).toBe(false)
  })

  test('updates hsb normalized channels smoothly', () => {
    const model = createColorPickerModel(base)
    const updated = updateHSBChannel(model, 'b', 45.6)
    expect(updated.a).toBeCloseTo(base.a, 5)
    expect(updated).not.toEqual(base)
  })

  test('percent helpers roundtrip safely', () => {
    expect(fromPercent(toPercent(0.347))).toBeCloseTo(0.35, 2)
  })
})
