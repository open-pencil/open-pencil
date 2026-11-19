import { expect, test } from 'bun:test'

import type { NodeType, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import { nodeOutlinePath } from '#core/io/formats/svg/paths'

const corner = { x: 0, y: 0 }
const line = (start: number, end: number) => ({
  start,
  end,
  tangentStart: corner,
  tangentEnd: corner
})

/** A skip-back icon: a filled triangle beside a bar, which no region encloses. */
const network: VectorNetwork = {
  vertices: [
    { x: 19, y: 20 },
    { x: 9, y: 12 },
    { x: 19, y: 4 },
    { x: 5, y: 19 },
    { x: 5, y: 5 }
  ],
  segments: [line(0, 1), line(1, 2), line(2, 0), line(3, 4)],
  regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
}

const shape = (type: NodeType, overrides: Partial<SceneNode> = {}) =>
  createDefaultNode(() => 'shape', type, { width: 100, height: 50, ...overrides })

test("a shape layer's outline is drawn in its own box", () => {
  expect(nodeOutlinePath(shape('RECTANGLE'))).toBe('M0 0L100 0L100 50L0 50L0 0Z')
  expect(nodeOutlinePath(shape('RECTANGLE', { cornerRadius: 10 }))).toContain('A10 10')
  expect(nodeOutlinePath(shape('LINE', { height: 0 }))).toBe('M0 0L100 0')
  expect(nodeOutlinePath(shape('VECTOR', { vectorNetwork: network }))).toBe(
    'M19 20L9 12L19 4L19 20ZM5 19L5 5'
  )
})

test('an ellipse without arc data draws whole, and an arc draws its sweep', () => {
  expect(nodeOutlinePath(shape('ELLIPSE', { arcData: null }))).toBe(
    'M0 25A50 25 0 1 1 100 25A50 25 0 1 1 0 25Z'
  )
  const half = { startingAngle: 0, endingAngle: Math.PI, innerRadius: 0 }
  expect(nodeOutlinePath(shape('ELLIPSE', { arcData: half }))).toBe(
    'M100 25A50 25 0 0 1 0 25L50 25Z'
  )
})

test('a polygon and a star draw their points, and other layers have no outline', () => {
  expect(nodeOutlinePath(shape('POLYGON', { pointCount: 3 }))?.match(/L/g)).toHaveLength(2)
  expect(nodeOutlinePath(shape('STAR', { pointCount: 5 }))?.match(/L/g)).toHaveLength(9)
  expect(nodeOutlinePath(shape('FRAME'))).toBeNull()
  expect(nodeOutlinePath(shape('VECTOR', { vectorNetwork: null }))).toBeNull()
})

test('a whole donut draws its outer edge and its hole the other way, so the hole stays empty', () => {
  const donut = { startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: 0.5 }
  expect(nodeOutlinePath(shape('ELLIPSE', { arcData: donut }))).toBe(
    'M0 25A50 25 0 1 1 100 25A50 25 0 1 1 0 25ZM25 25A25 12.5 0 1 0 75 25A25 12.5 0 1 0 25 25Z'
  )
})

test('a smoothed rectangle traces its corners as the canvas does', () => {
  const smooth = nodeOutlinePath(shape('RECTANGLE', { cornerRadius: 20, cornerSmoothing: 0.6 }))
  expect(smooth).toMatch(/^M[^Z]*C[^Z]*A[^Z]*Z$/)
  expect(smooth).not.toBe(nodeOutlinePath(shape('RECTANGLE', { cornerRadius: 20 })))
  expect(nodeOutlinePath(shape('RECTANGLE', { cornerSmoothing: 0.6 }))).toBe(
    'M0 0L100 0L100 50L0 50L0 0Z'
  )
})
