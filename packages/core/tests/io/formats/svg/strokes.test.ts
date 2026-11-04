import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import { SceneGraph, type SceneNode, type Stroke } from '@open-pencil/scene-graph'

const stroke = (align: Stroke['align']): Stroke => ({
  type: 'SOLID',
  color: { r: 0.7, g: 0.7, b: 0.7, a: 1 },
  opacity: 1,
  visible: true,
  weight: 2,
  align
})

/** The SVG for one 200 × 120 layer of `type` with a 2 px stroke aligned `align`. */
function exported(type: 'RECTANGLE' | 'ELLIPSE' | 'FRAME', align: Stroke['align']): string {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const props: Partial<SceneNode> = {
    width: 200,
    height: 120,
    cornerRadius: type === 'ELLIPSE' ? 0 : 12,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
    strokes: [stroke(align)]
  }
  const node = graph.createNode(type, page, props)
  return expectDefined(renderNodesToSVG(graph, page, [node.id], { xmlDeclaration: false }))
}

/** The clip path an element names, by its id. */
function clipOf(svg: string, element: string): string {
  const id = expectDefined(/clip-path="url\(#([^)]+)\)"/.exec(element))[1]
  return expectDefined(new RegExp(`<clipPath id="${id}">([\\s\\S]*?)</clipPath>`).exec(svg))[1]
}

describe('aligned strokes exported to SVG', () => {
  test('an inside stroke stays in the box: twice its weight, clipped to the outline', () => {
    const svg = exported('FRAME', 'INSIDE')
    const stroked = expectDefined(/<path [^>]*stroke="#B3B3B3"[^>]*>/.exec(svg))[0]
    expect(stroked).toContain('stroke-width="4"')
    const outline = expectDefined(/ d="([^"]+)"/.exec(stroked))[1]
    expect(clipOf(svg, stroked)).toContain(`d="${outline}"`)
    // The fill is drawn without a stroke of its own.
    expect(svg).toMatch(/<rect [^>]*fill="#FFFFFF"(?![^>]*stroke=)[^>]*\/>/)
  })

  test('an outside stroke keeps out of the box: clipped to everything around the outline', () => {
    const svg = exported('ELLIPSE', 'OUTSIDE')
    const stroked = expectDefined(/<path [^>]*stroke="#B3B3B3"[^>]*>/.exec(svg))[0]
    expect(stroked).toContain('stroke-width="4"')
    expect(clipOf(svg, stroked)).toContain('clip-rule="evenodd"')
  })

  test('a centred stroke is drawn on the shape at its own weight', () => {
    const svg = exported('RECTANGLE', 'CENTER')
    expect(svg).toMatch(/<rect [^>]*stroke="#B3B3B3" stroke-width="2"/)
    expect(svg).not.toContain('clip-path')
  })

  test('an outside stroke’s clip reaches as far as its mitred tips', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const star = graph.createNode('STAR', page, {
      width: 100,
      height: 100,
      pointCount: 5,
      starInnerRadius: 0.2,
      strokeMiterLimit: 10,
      strokes: [{ ...stroke('OUTSIDE'), weight: 4 }]
    })
    const svg = expectDefined(renderNodesToSVG(graph, page, [star.id], { xmlDeclaration: false }))
    const stroked = expectDefined(/<path [^>]*stroke="#B3B3B3"[^>]*>/.exec(svg))[0]
    // A miter of the doubled stroke reaches its weight, 4, times the miter limit past the tip.
    const [, left] = expectDefined(/d="M(-?[\d.]+) /.exec(clipOf(svg, stroked)))
    expect(Number(left)).toBeLessThanOrEqual(-40)
  })
})
