import { afterAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'

import { makeBooleanOperationPath } from '#core/canvas/boolean'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const SOLID = {
  type: 'SOLID' as const,
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true
}

// Live-verified: a frame operand gives a boolean operation its children's shapes only.
test("a frame operand gives only its children's shapes, not its own fill or stroke", () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const operation = graph.createNode('BOOLEAN_OPERATION', page.id, {
    width: 100,
    height: 100,
    booleanOperation: 'UNION',
    fills: [SOLID]
  })
  const frame = graph.createNode('FRAME', operation.id, {
    x: 20,
    y: 20,
    width: 40,
    height: 40,
    fills: [SOLID],
    strokes: [{ ...SOLID, weight: 4, align: 'INSIDE' }]
  })
  graph.createNode('RECTANGLE', frame.id, { x: 30, y: 2, width: 8, height: 8, fills: [SOLID] })
  graph.createNode('RECTANGLE', operation.id, {
    x: 70,
    y: 70,
    width: 10,
    height: 10,
    fills: [SOLID]
  })

  const path = expectDefined(makeBooleanOperationPath(renderer, operation, graph))
  try {
    expect(path.contains(30, 45)).toBe(false)
    expect(path.contains(54, 26)).toBe(true)
    expect(path.contains(75, 75)).toBe(true)
  } finally {
    path.delete()
  }
})
