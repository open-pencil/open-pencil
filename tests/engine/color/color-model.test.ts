import { describe, expect, test } from 'bun:test'

import { ref } from 'vue'

import type { OkHCLColor } from '@open-pencil/core'
import type { Color } from '@open-pencil/scene-graph'
import type { ColorFieldFormat } from '@open-pencil/vue'
import { BUILT_IN_COLOR_FORMATS, fromPercent, toPercent, useColorModel } from '@open-pencil/vue'

function expectColorClose(actual: Color, expected: Color, precision = 5) {
  expect(actual.r).toBeCloseTo(expected.r, precision)
  expect(actual.g).toBeCloseTo(expected.g, precision)
  expect(actual.b).toBeCloseTo(expected.b, precision)
  expect(actual.a).toBeCloseTo(expected.a, precision)
}

describe('useColorModel', () => {
  const base: Color = { r: 0.4, g: 0.2, b: 0.6, a: 0.75 }

  test('bridges scene and Reka RGB without quantizing channels', () => {
    const updates: Color[] = []
    const model = useColorModel({ color: base, onUpdate: (color) => updates.push(color) })

    expect(model.rekaColor.value).toEqual({
      space: 'rgb',
      r: 102,
      g: 51,
      b: 153,
      alpha: 0.75
    })

    const next = model.updateFromReka(model.rekaColor.value)
    expectColorClose(next, base)
    expect(updates).toHaveLength(0)
  })

  test('preserves fractional RGB precision through the Reka bridge', () => {
    const precise: Color = { r: 0.1234, g: 0.5678, b: 0.9012, a: 0.3456 }
    const model = useColorModel({ color: precise })
    expectColorClose(model.updateFromReka(model.rekaColor.value), precise, 8)
  })

  test('updates hue from grayscale colors without staying neutral', () => {
    const grayscale: Color = { r: 1, g: 1, b: 1, a: 1 }
    const model = useColorModel({ color: grayscale })
    const updated = model.updateHue(220)
    expect(updated.r === updated.g && updated.g === updated.b).toBe(false)
    expect(updated.a).toBe(1)
  })

  test('formats and updates hex while preserving alpha', () => {
    const updates: Color[] = []
    const model = useColorModel({ color: base, onUpdate: (color) => updates.push(color) })
    expect(model.hex.value).toBe('663399')
    const updated = model.updateHex('FF8040')
    expect(updated).toEqual({ r: 1, g: 128 / 255, b: 64 / 255, a: base.a })
    expect(updates).toEqual([updated])
  })

  test('normalizes hue and clamps alpha and RGB channels', () => {
    const model = useColorModel({ color: base })
    expect(model.updateHue(-20)).toBeDefined()
    expect(model.updateAlpha(2).a).toBe(1)
    expect(model.updateRGBChannel('r', -20).r).toBe(0)
    expect(model.updateRGBChannel('b', 300).b).toBe(1)
  })

  test('updates HSL saturation from white without staying neutral', () => {
    const white: Color = { r: 1, g: 1, b: 1, a: 1 }
    const model = useColorModel({ color: white })
    const updated = model.updateHSLChannel('s', 40)
    expect(updated.r === updated.g && updated.g === updated.b).toBe(false)
  })

  test('updates HSL and HSB channels while preserving alpha', () => {
    const model = useColorModel({ color: base })
    expect(model.updateHSLChannel('l', 12.3).a).toBeCloseTo(base.a, 5)
    expect(model.updateHSBChannel('b', 45.6).a).toBeCloseTo(base.a, 5)
  })

  test('uses supplied OkHCL intent and emits normalized patches', () => {
    const okhcl: OkHCLColor = { h: 250, c: 0.18, l: 0.62, a: 0.75 }
    const patches: Partial<OkHCLColor>[] = []
    const model = useColorModel({
      color: base,
      okhcl,
      onUpdateOkHCL: (patch) => {
        patches.push(patch)
      }
    })

    expect(model.okhcl.value).toEqual(okhcl)
    expect(model.updateOkHCLChannel('h', 370).h).toBe(10)
    expect(model.updateOkHCLChannel('c', -1).c).toBe(0)
    expect(model.updateOkHCLChannel('l', 2).l).toBe(1)
    expect(model.updateOkHCLChannel('a', -1).a).toBe(0)
    expect(patches).toEqual([{ h: 10 }, { c: 0 }, { l: 1 }, { a: 0 }])
  })

  test('updates scene color when an OkHCL adapter is absent', () => {
    const updates: Color[] = []
    const model = useColorModel({ color: base, onUpdate: (color) => updates.push(color) })
    model.updateOkHCLChannel('h', model.okhcl.value.h + 20)
    expect(updates).toHaveLength(1)
    expect(updates[0].a).toBeCloseTo(base.a, 5)
  })

  test('does not emit no-op color or OkHCL updates', () => {
    const updates: Color[] = []
    const patches: Partial<OkHCLColor>[] = []
    const okhcl: OkHCLColor = { h: 250, c: 0.18, l: 0.62, a: 0.75 }
    const model = useColorModel({
      color: base,
      okhcl,
      onUpdate: (color) => updates.push(color),
      onUpdateOkHCL: (patch) => {
        patches.push(patch)
      }
    })

    model.updateAlpha(base.a)
    model.updateOkHCLChannel('c', okhcl.c)
    expect(updates).toHaveLength(0)
    expect(patches).toHaveLength(0)
  })

  test('supports local and controlled format state', () => {
    const local = useColorModel({ color: base, defaultFormat: 'hsl' })
    expect(local.format.value).toBe('hsl')
    local.setFormat('okhcl')
    expect(local.format.value).toBe('okhcl')

    const controlledFormat = ref<ColorFieldFormat>('rgb')
    const changes: string[] = []
    const controlled = useColorModel({
      color: base,
      format: controlledFormat,
      onFormatChange: (format) => changes.push(format)
    })
    controlled.setFormat('hsb')
    expect(controlled.format.value).toBe('rgb')
    expect(changes).toEqual(['hsb'])
    controlledFormat.value = 'hsb'
    expect(controlled.format.value).toBe('hsb')
  })

  test('exposes built-in formats and culori-backed gradient models', () => {
    const model = useColorModel({ color: base })
    expect(BUILT_IN_COLOR_FORMATS).toEqual(['hex', 'rgb', 'hsl', 'hsb', 'okhcl'])
    expect(model.sliderGradient.value.hslLightness).toContain('linear-gradient')
    expect(model.sliderGradient.value.hsbBrightness).toContain('linear-gradient')
    expect(model.okhclSliderGradient.value.okhclChroma).toContain('linear-gradient')
    expect(model.okhclSliderPreview.value.okhclHue.a).toBeCloseTo(base.a, 5)
  })

  test('percent helpers roundtrip safely', () => {
    expect(fromPercent(toPercent(0.347))).toBeCloseTo(0.35, 2)
  })
})
