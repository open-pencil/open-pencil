import { describe, expect, test } from 'bun:test'

import { renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { createShapeWithText } from '@open-pencil/scene-graph/generated'
import { outlineSVGPath } from '@open-pencil/scene-graph/paths'
import { shapeWithTextGeometry } from '@open-pencil/scene-graph/shape-with-text'
import { expectDefined } from '@open-pencil/test-support/assert'

import { BLACK_STROKE } from './helpers'

describe('FigJam shapes exported to SVG', () => {
  const stroke = BLACK_STROKE

  /** The SVG a page holding one FigJam shape of `type`, outlined in black, exports to. */
  function exportedShape(shapeWithTextType: SceneNode['shapeWithTextType']) {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const shape = createShapeWithText(
      graph,
      page,
      { shapeWithTextType, width: 120, height: 80, strokes: [stroke] },
      {}
    )
    return { shape, svg: expectDefined(renderNodesToSVG(graph, page, [shape.id])) }
  }

  test('draw their own outline, not a box', () => {
    const { shape, svg } = exportedShape('DIAMOND')
    const outline = outlineSVGPath(
      shapeWithTextGeometry('DIAMOND', shape.width, shape.height, shape.cornerRadius).outline,
      (value) => Math.round(value * 100) / 100
    )
    expect(svg).toContain(`d="${outline}"`)
    expect(svg).not.toContain('<rect')
  })

  test('stroke their inner lines inside the outline, as a database’s front rim', () => {
    const { svg } = exportedShape('ENG_DATABASE')
    const rim = expectDefined(
      svg.match(/<path d="[^"]+" fill="none"[^>]*clip-path="url\(#([^)]+)\)"/)
    )
    expect(svg).toContain(`<clipPath id="${rim[1]}">`)
    expect(exportedShape('DIAMOND').svg).not.toContain('clip-path')
  })
})
