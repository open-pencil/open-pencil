import { describe, expect, test } from 'bun:test'

import { resolveOkHCLForPreview, resolveRGBAForPreview } from '#core/color/management'

/** #2563EB as authored in an sRGB document. */
const BLUE = { r: 0.1450980392156863, g: 0.38823529411764707, b: 0.9215686274509803, a: 1 }
/** Saturated P3 red, far outside sRGB. */
const P3_RED = { r: 1, g: 0, b: 0, a: 1 }

describe('document colour profile conversion', () => {
  test('an sRGB document painting into an sRGB surface keeps its numbers', () => {
    const resolved = resolveRGBAForPreview(BLUE, {
      documentColorSpace: 'srgb',
      colorSpace: 'srgb'
    })
    expect(resolved.color.r).toBeCloseTo(BLUE.r, 5)
    expect(resolved.color.b).toBeCloseTo(BLUE.b, 5)
    expect(resolved.clipped).toBe(false)
  })

  test('a P3 document painting into a P3 surface keeps its numbers', () => {
    const resolved = resolveRGBAForPreview(P3_RED, {
      documentColorSpace: 'display-p3',
      colorSpace: 'display-p3'
    })
    expect(resolved.color).toEqual(P3_RED)
    expect(resolved.clipped).toBe(false)
  })

  test('a P3 document converts into an sRGB surface and reports clipping', () => {
    const resolved = resolveRGBAForPreview(P3_RED, {
      documentColorSpace: 'display-p3',
      colorSpace: 'srgb'
    })
    // P3 red is outside sRGB: the coordinates go out of range and the surface clamps them
    // when painting, which is the "closest approximate colour" the profile change documents.
    expect(resolved.color.r).toBeGreaterThan(1)
    expect(resolved.color.g).toBeLessThan(0)
    expect(resolved.color.b).toBeLessThan(0)
    expect(resolved.clipped).toBe(true)
    expect(resolved.cssColor).toBe('rgb(255, 0, 0)')
  })

  test('an sRGB document converts into a P3 surface', () => {
    const resolved = resolveRGBAForPreview(BLUE, {
      documentColorSpace: 'srgb',
      colorSpace: 'display-p3'
    })
    // The same colour, expressed in P3 coordinates: slightly different numbers.
    expect(resolved.color).not.toEqual(BLUE)
    expect(resolved.color.b).toBeCloseTo(0.89, 2)
    expect(resolved.clipped).toBe(false)
  })

  test('recognised document colours report their own space when no target is requested', () => {
    const resolved = resolveRGBAForPreview(BLUE, { documentColorSpace: 'display-p3' })
    expect(resolved.targetSpace).toBe('display-p3')
    expect(resolved.color).toEqual(BLUE)
  })

  test('OKHCL colours resolve into the requested target space', () => {
    const okhcl = { l: 0.6, c: 0.3, h: 20, a: 1 }
    const srgb = resolveOkHCLForPreview(okhcl, { colorSpace: 'srgb' })
    const p3 = resolveOkHCLForPreview(okhcl, { colorSpace: 'display-p3' })
    expect(srgb.targetSpace).toBe('srgb')
    expect(p3.targetSpace).toBe('display-p3')
    // P3 is the wider space, so the same colour needs fewer of its primaries.
    expect(p3.color.r).toBeLessThan(srgb.color.r)
  })
})
