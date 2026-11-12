import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { layoutGeometryChanges } from '#core/layout/apply'

function rectangle() {
  const graph = new SceneGraph()
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    width: 100,
    height: 50,
    x: 10,
    y: 20
  })
  return node
}

describe('layoutGeometryChanges', () => {
  test('writes only the geometry layout changed', () => {
    const node = rectangle()
    expect(layoutGeometryChanges(node, { x: 10, y: 20, width: 120 })).toEqual({ width: 120 })
  })

  test('writes nothing when layout lands on the geometry the layer has', () => {
    const node = rectangle()
    expect(layoutGeometryChanges(node, { x: 10, y: 20, width: 100, height: 50 })).toEqual({})
  })

  test('keeps the layer geometry when layout computes a non-finite value', () => {
    const node = rectangle()
    const infinite = layoutGeometryChanges(node, {
      x: Number.POSITIVE_INFINITY,
      width: Number.NEGATIVE_INFINITY,
      height: Number.NaN
    })
    expect(infinite).toEqual({})
  })

  test('writes a flip flag, which layout reports as a boolean', () => {
    const node = rectangle()
    expect(layoutGeometryChanges(node, { flipX: true, flipY: false })).toEqual({ flipX: true })
  })

  test('turns a flip flag off again', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, { flipX: true })
    expect(layoutGeometryChanges(node, { flipX: false })).toEqual({ flipX: false })
  })
})
