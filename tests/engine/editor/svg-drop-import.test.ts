import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createSvgNodes } from '#core/tools/create/svg'

import { expectDefined } from '#tests/helpers/assert'

const STAR_SVG = `<svg viewBox="0 0 24 24" width="48" height="48">
  <path d="M12 2 L15 9 L22 9 L16 14 L18 21 L12 17 L6 21 L8 14 L2 9 L9 9 Z" fill="#ff6600"/>
  <path d="M0 0 H24 V24 H0 Z" fill="none" stroke="#333333" stroke-width="2"/>
</svg>`

const MULTI_COLOR_SVG = `<svg viewBox="0 0 100 100" width="100" height="100">
  <path d="M0 0 H50 V50 H0 Z" fill="#ff0000"/>
  <path d="M50 0 H100 V50 H50 Z" fill="#00ff00"/>
  <path d="M0 50 H100 V100 H0 Z" fill="#0000ff"/>
</svg>`

describe('SVG drop import', () => {
  test('filled paths flatten into one multi-color vector', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])

    const vector = expectDefined(
      createSvgNodes(graph, page.id, MULTI_COLOR_SVG, { name: 'tiles' }),
      'imported vector'
    )

    // one node, no wrapper — like Figma's flattened representation
    expect(vector.type).toBe('VECTOR')
    expect(vector.name).toBe('tiles')
    expect(vector.childIds).toHaveLength(0)
    expect(vector.width).toBeCloseTo(100, 4)
    expect(vector.height).toBeCloseTo(100, 4)

    const network = expectDefined(vector.vectorNetwork, 'vectorNetwork')
    expect(network.regions).toHaveLength(3)

    expect(vector.fillGeometry).toHaveLength(3)
    const fillOf = (i: number) => expectDefined(vector.fillGeometry[i]?.fills?.[0]?.color)
    expect(fillOf(0).r).toBeCloseTo(1, 2)
    expect(fillOf(1).g).toBeCloseTo(1, 2)
    expect(fillOf(2).b).toBeCloseTo(1, 2)
    expect(vector.fillGeometry.map((g) => g.styleID)).toEqual([1, 2, 3])
    // command blobs were synthesized from the merged network
    expect(vector.fillGeometry.every((g) => g.commandsBlob.length > 0)).toBe(true)
  })

  test('stroked paths stay separate next to the flattened fills', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])

    const root = expectDefined(createSvgNodes(graph, page.id, STAR_SVG, { name: 'star' }))

    expect(root.type).toBe('GROUP')
    expect(root.childIds).toHaveLength(2)

    const flattened = expectDefined(graph.getNode(root.childIds[0]))
    expect(flattened.type).toBe('VECTOR')
    expect(flattened.fillGeometry).toHaveLength(1)
    expect(flattened.fillGeometry[0]?.fills?.[0]?.color.r).toBeCloseTo(1, 2)
    // star spans x 2..22, y 2..21 in a 24-unit viewBox scaled to 48px
    expect(flattened.x).toBeCloseTo(4, 4)
    expect(flattened.width).toBeCloseTo(40, 4)

    const stroked = expectDefined(graph.getNode(root.childIds[1]))
    expect(stroked.fills).toHaveLength(0)
    expect(stroked.strokes[0]?.weight).toBe(2)
  })

  test('createSvgNodes returns null for markup without supported elements', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    expect(createSvgNodes(graph, page.id, '<svg><text>hi</text></svg>')).toBeNull()
  })
})
