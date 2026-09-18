import { describe, expect, test } from 'bun:test'

import {
  colorDistance,
  getFillOkHCL,
  okhclToRGBA,
  rgbaToOkHCL,
  setNodeFillOkHCL,
  setNodeStrokeOkHCL
} from '@open-pencil/core/color'
import { SceneGraph } from '@open-pencil/scene-graph'

const SATURATED = { l: 0.6, c: 0.3, h: 20, a: 1 }

function createNode() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  return graph.createNode('RECTANGLE', page.id, {
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    strokes: [
      { color: { r: 0, g: 0, b: 0, a: 1 }, weight: 1, opacity: 1, visible: true, align: 'INSIDE' }
    ]
  })
}

describe('OKHCL colours follow the document profile', () => {
  test('resolves the same colour into the requested coordinates', () => {
    const srgb = okhclToRGBA(SATURATED)
    const p3 = okhclToRGBA(SATURATED, 'display-p3')

    // P3 is the wider space, so the same colour needs fewer of its primaries.
    expect(p3.r).toBeLessThan(srgb.r)
    expect(p3).not.toEqual(srgb)
    // Round-tripping through the matching space returns the original colour.
    expect(colorDistance(okhclToRGBA(rgbaToOkHCL(srgb), 'srgb'), srgb)).toBeLessThan(1)
    expect(
      colorDistance(okhclToRGBA(rgbaToOkHCL(p3, 'display-p3'), 'display-p3'), p3)
    ).toBeLessThan(1)
  })

  test('reading stored coordinates in the wrong space shifts the picker values', () => {
    const p3 = okhclToRGBA(SATURATED, 'display-p3')
    const asP3 = rgbaToOkHCL(p3, 'display-p3')
    const asSrgb = rgbaToOkHCL(p3)
    // Chroma and lightness both drift when P3 coordinates are read as sRGB.
    expect(Math.abs(asSrgb.c - asP3.c)).toBeGreaterThan(0.03)
    expect(Math.abs(asSrgb.l - asP3.l)).toBeGreaterThan(0.015)
    // Read in the document's own space, the stored colour comes back exactly.
    expect(colorDistance(okhclToRGBA(asP3, 'display-p3'), p3)).toBeLessThan(0.001)
  })

  test('a Display-P3 document stores P3 coordinates for picker edits', () => {
    const node = createNode()
    const patch = setNodeFillOkHCL(node, 0, SATURATED, 'display-p3')
    const stored = patch.fills?.[0]?.color
    expect(stored).toBeDefined()
    expect(stored?.r).toBeLessThan(okhclToRGBA(SATURATED).r)
    expect(
      colorDistance(stored ?? { r: 0, g: 0, b: 0, a: 1 }, okhclToRGBA(SATURATED, 'display-p3'))
    ).toBeLessThan(1)
    // The perceptual payload still travels with the fill.
    expect(getFillOkHCL({ ...node, ...patch } as typeof node, 0)?.color.h).toBeCloseTo(
      SATURATED.h,
      3
    )
  })

  test('an sRGB document keeps storing sRGB coordinates', () => {
    const node = createNode()
    const patch = setNodeFillOkHCL(node, 0, SATURATED)
    expect(patch.fills?.[0]?.color).toEqual(okhclToRGBA(SATURATED))
    const strokePatch = setNodeStrokeOkHCL(node, 0, SATURATED)
    expect(strokePatch.strokes?.[0]?.color).toEqual(okhclToRGBA(SATURATED))
  })
})
