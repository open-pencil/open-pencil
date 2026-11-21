import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  colorToProfileCSS,
  convertColor,
  fitsGamut,
  okhclInProfile,
  okhclToRGBA,
  paintOkHCL,
  rgbaToOkHCL,
  setNodeFillOkHCL,
  toExtendedSRGB
} from '@open-pencil/scene-graph/color'

/** #2563EB as authored in an sRGB document. */
const BLUE = { r: 0.1450980392156863, g: 0.38823529411764707, b: 0.9215686274509803, a: 1 }
/** Saturated P3 red, far outside sRGB. */
const P3_RED = { r: 1, g: 0, b: 0, a: 1 }

describe('converting colors between profiles', () => {
  test('the same profile keeps the numbers', () => {
    expect(convertColor(P3_RED, 'display-p3', 'display-p3')).toEqual(P3_RED)
    expect(convertColor(BLUE, 'srgb', 'srgb', 'map')).toEqual(BLUE)
  })

  test('extending keeps a wide-gamut color whole, past 0 and 1', () => {
    const red = toExtendedSRGB(P3_RED, 'display-p3')
    expect(red.r).toBeGreaterThan(1)
    expect(red.g).toBeLessThan(0)
    expect(red.b).toBeLessThan(0)
  })

  test('extending gives the components converting exactly does, inside sRGB and out', () => {
    const colors = [
      P3_RED,
      BLUE,
      { r: 0.02, g: 0.5, b: 1, a: 0.4 },
      { r: -0.1, g: 1.2, b: 0, a: 1 }
    ]
    for (const color of colors) {
      const exact = convertColor(color, 'display-p3', 'srgb')
      const fast = toExtendedSRGB(color, 'display-p3')
      for (const channel of ['r', 'g', 'b', 'a'] as const) {
        expect(fast[channel]).toBeCloseTo(exact[channel], 12)
      }
    }
  })

  test('mapping brings a color the target cannot show inside it, keeping its hue', () => {
    const red = convertColor(P3_RED, 'display-p3', 'srgb', 'map')
    expect(fitsGamut(red)).toBe(true)
    expect(red.r).toBeGreaterThan(0.95)
    expect(red.g).toBeLessThan(0.25)
  })

  test('an sRGB color takes less of P3’s wider primaries', () => {
    const blue = convertColor(BLUE, 'srgb', 'display-p3', 'map')
    expect(blue.b).toBeCloseTo(0.89, 2)
  })

  test('CSS shows a color in the profile asked for', () => {
    expect(colorToProfileCSS(P3_RED, 'display-p3', 'display-p3')).toBe('color(display-p3 1 0 0)')
    expect(colorToProfileCSS(BLUE, 'srgb', 'srgb')).toBe('rgb(37, 99, 235)')
    // Shown in sRGB, a P3 red clips per channel, as a canvas clips it.
    expect(colorToProfileCSS(P3_RED, 'display-p3', 'srgb')).toBe('rgb(255, 0, 0)')
  })
})

describe('OkHCL at the edge of a gamut', () => {
  test('colors on the edge are not clipped, whatever round-off says', () => {
    for (const color of [P3_RED, { r: 0, g: 1, b: 0, a: 1 }, { r: 1, g: 1, b: 1, a: 1 }]) {
      const okhcl = rgbaToOkHCL(color, 'display-p3')
      const { color: back, clipped } = okhclInProfile(okhcl, 'display-p3')
      expect(clipped).toBe(false)
      for (const key of ['r', 'g', 'b'] as const) expect(back[key]).toBeCloseTo(color[key], 9)
    }
    expect(okhclInProfile(rgbaToOkHCL({ r: 0, g: 0, b: 1, a: 1 }), 'srgb').clipped).toBe(false)
  })

  test('a color past the gamut is clipped and brought inside', () => {
    const vivid = rgbaToOkHCL(P3_RED, 'display-p3')
    const { color, clipped } = okhclInProfile(vivid, 'srgb')
    expect(clipped).toBe(true)
    expect(fitsGamut(color)).toBe(true)
  })

  test('a paint’s OkHCL color counts only while it still makes the stored color', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      fills: [{ type: 'SOLID', color: P3_RED, opacity: 1, visible: true }]
    })
    const okhcl = rgbaToOkHCL(P3_RED, 'display-p3')
    graph.updateNode(node.id, setNodeFillOkHCL(node, 0, okhcl, 'display-p3'))
    expect(paintOkHCL(node, 'fill', 0, 'display-p3')).toEqual(okhcl)
    // Read in another profile, or after another edit of the color, it no longer describes it.
    expect(paintOkHCL(node, 'fill', 0, 'srgb')).toBeNull()
    graph.updateNode(node.id, {
      fills: [
        { ...node.fills[0], color: okhclToRGBA({ ...okhcl, h: okhcl.h + 120 }, 'display-p3') }
      ]
    })
    expect(paintOkHCL(node, 'fill', 0, 'display-p3')).toBeNull()
  })
})
