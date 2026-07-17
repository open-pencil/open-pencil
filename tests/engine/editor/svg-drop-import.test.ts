import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createSvgNodes } from '#core/tools/create/svg'

import { expectDefined } from '#tests/helpers/assert'

const STAR_SVG = `<svg viewBox="0 0 24 24" width="48" height="48">
  <path d="M12 2 L15 9 L22 9 L16 14 L18 21 L12 17 L6 21 L8 14 L2 9 L9 9 Z" fill="#ff6600"/>
  <path d="M0 0 H24 V24 H0 Z" fill="none" stroke="#333333" stroke-width="2"/>
</svg>`

describe('SVG drop import', () => {
  test('createSvgNodes builds a group of vectors sized from the markup', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])

    const frame = expectDefined(
      createSvgNodes(graph, page.id, STAR_SVG, { name: 'star' }),
      'imported frame'
    )

    expect(frame.type).toBe('GROUP')
    expect(frame.name).toBe('star')
    expect(frame.width).toBe(48)
    expect(frame.height).toBe(48)
    expect(frame.childIds).toHaveLength(2)

    const star = expectDefined(graph.getNode(frame.childIds[0]))
    expect(star.type).toBe('VECTOR')
    expect(star.fills[0]?.color.r).toBeCloseTo(1, 2)
    expect(star.fills[0]?.color.g).toBeCloseTo(0.4, 2)
    // viewBox is 24 units but the node is 48px — coordinates map to node space,
    // and each vector hugs its own path bounds (star spans x 2..22, y 2..21).
    expect(star.x).toBeCloseTo(4, 4)
    expect(star.y).toBeCloseTo(4, 4)
    expect(star.width).toBeCloseTo(40, 4)
    expect(star.height).toBeCloseTo(38, 4)
    const network = expectDefined(star.vectorNetwork, 'vectorNetwork')
    expect(network.vertices[0]?.x).toBeCloseTo(20, 4) // (12 − 2) × 2 in node space
    expect(network.vertices[0]?.y).toBeCloseTo(0, 4)

    const border = expectDefined(graph.getNode(frame.childIds[1]))
    expect(border.fills).toHaveLength(0)
    expect(border.strokes[0]?.weight).toBe(2)
  })

  test('createSvgNodes returns null for markup without supported elements', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    expect(createSvgNodes(graph, page.id, '<svg><text>hi</text></svg>')).toBeNull()
  })
})
