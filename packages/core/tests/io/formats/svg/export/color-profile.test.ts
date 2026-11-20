import { describe, expect, test } from 'bun:test'

import { renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import { SceneGraph, type ColorProfile } from '@open-pencil/scene-graph'
import { convertColor, colorToHex } from '@open-pencil/scene-graph/color'
import { expectDefined } from '@open-pencil/test-support/assert'

/** A document in `profile` with one rectangle of `color`, exported as SVG in `target`. */
function exported(
  profile: ColorProfile,
  color: { r: number; g: number; b: number },
  target?: ColorProfile
) {
  const graph = new SceneGraph()
  graph.documentColorSpace = profile
  const page = graph.getPages()[0]
  const rect = graph.createNode('RECTANGLE', page.id, {
    width: 40,
    height: 40,
    fills: [{ type: 'SOLID', color: { ...color, a: 1 }, opacity: 1, visible: true }]
  })
  const svg = renderNodesToSVG(graph, page.id, [rect.id], { colorSpace: target })
  return expectDefined(svg, 'svg')
}

describe('SVG export of a document in a color profile', () => {
  test('a Display P3 document writes its colors in P3 unless told otherwise', () => {
    expect(exported('display-p3', { r: 1, g: 0, b: 0 })).toContain('fill="color(display-p3 1 0 0)"')
  })

  test('a Display P3 document written as sRGB maps its colors into sRGB', () => {
    const svg = exported('display-p3', { r: 1, g: 0, b: 0 }, 'srgb')
    const mapped = convertColor({ r: 1, g: 0, b: 0, a: 1 }, 'display-p3', 'srgb', 'map')
    expect(svg).toContain(`fill="${colorToHex(mapped)}"`)
  })

  test('an sRGB document written as P3 converts its colors once', () => {
    const svg = exported('srgb', { r: 0.2, g: 0.5, b: 0.8 }, 'display-p3')
    const p3 = convertColor({ r: 0.2, g: 0.5, b: 0.8, a: 1 }, 'srgb', 'display-p3')
    expect(svg).toContain(`color(display-p3 ${p3.r} ${p3.g} ${p3.b})`)
  })

  test('an sRGB document keeps writing hex', () => {
    expect(exported('srgb', { r: 1, g: 0, b: 0 })).toContain('fill="#FF0000"')
  })
})
