/**
 * Tests for computeDescendantVisualBounds in packages/core/src/geometry.ts.
 *
 * This function computes visual bounds for a node and all its descendants,
 * accounting for world-space transforms including rotation.
 */
import { describe, test, expect } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import { getAbsolutePositionFull } from '@open-pencil/core/canvas'

import { getWorldMatrix } from '#core/canvas/coordinate'
import { computeDescendantVisualBounds } from '#core/geometry'

describe('computeDescendantVisualBounds', () => {
  test('includes descendants correctly when an ancestor is rotated', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Rotated frame',
      x: 400,
      y: 200,
      width: 240,
      height: 240,
      rotation: 45,
      clipsContent: false
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      name: 'Wide child',
      x: -800,
      y: 40,
      width: 1200,
      height: 80
    })

    const bounds = computeDescendantVisualBounds(
      [frame.id],
      (id) => graph.getNode(id),
      (id) => graph.getAbsolutePosition(id),
      (id) => {
        const node = graph.getNode(id)
        return node ? getWorldMatrix(node, graph) : null
      }
    )
    const childNode = graph.getNode(child.id)
    if (!childNode || !bounds) throw new Error('failed to create rotated descendant test graph')
    const childAABB = getAbsolutePositionFull(childNode, graph)

    expect(bounds.minX).toBeLessThanOrEqual(childAABB.boundX)
    expect(bounds.minY).toBeLessThanOrEqual(childAABB.boundY)
    expect(bounds.maxX).toBeGreaterThanOrEqual(childAABB.boundX + childAABB.width)
    expect(bounds.maxY).toBeGreaterThanOrEqual(childAABB.boundY + childAABB.height)
  })

  test('world-matrix bounds path rejects non-finite node dimensions', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const bad = graph.createNode('RECTANGLE', page.id, {
      name: 'Bad rect',
      width: Number.NaN,
      height: 20
    })

    const bounds = computeDescendantVisualBounds(
      [bad.id],
      (id) => graph.getNode(id),
      (id) => graph.getAbsolutePosition(id),
      (id) => {
        const node = graph.getNode(id)
        return node ? getWorldMatrix(node, graph) : null
      }
    )
    if (!bounds) throw new Error('expected bounds for NaN-guard regression')

    expect(Number.isFinite(bounds.minX)).toBe(true)
    expect(Number.isFinite(bounds.minY)).toBe(true)
    expect(Number.isFinite(bounds.maxX)).toBe(true)
    expect(Number.isFinite(bounds.maxY)).toBe(true)
  })
})
