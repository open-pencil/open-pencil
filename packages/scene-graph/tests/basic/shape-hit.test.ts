import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { Fill, SceneNode, Stroke, VectorNetwork } from '@open-pencil/scene-graph'

import { pageId } from './helpers'

const FILL: Fill = {
  type: 'SOLID',
  color: { r: 0, g: 0, b: 1, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL'
}

function stroke(weight: number, align: Stroke['align'] = 'CENTER'): Stroke {
  return { ...FILL, weight, align }
}

function shape(graph: SceneGraph, overrides: Partial<SceneNode> & Pick<SceneNode, 'type'>) {
  const { type, ...rest } = overrides
  return graph.createNode(type, pageId(graph), { x: 0, y: 0, width: 100, height: 100, ...rest }).id
}

function hit(graph: SceneGraph, x: number, y: number, pad = 0) {
  return graph.hitTestDeep(x, y, pageId(graph), pad)?.id ?? null
}

/** A right triangle (0,0) → (100,0) → (0,100) as one filled region. */
const TRIANGLE: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 }
  ],
  segments: [
    { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
  ],
  regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
}

/** An open L-shaped path: down the left edge, then along the bottom. */
const OPEN_L: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 }
  ],
  segments: [
    { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
  ],
  regions: []
}

describe('hit testing follows the drawn shape', () => {
  test('a filled ellipse is hit inside its oval, not in its box corners', () => {
    const graph = new SceneGraph()
    const id = shape(graph, { type: 'ELLIPSE', fills: [FILL] })
    expect(hit(graph, 50, 50)).toBe(id)
    expect(hit(graph, 3, 3)).toBeNull()
    expect(hit(graph, 97, 97)).toBeNull()
  })

  test('the hit padding grows an ellipse along its outline', () => {
    const graph = new SceneGraph()
    const id = shape(graph, { type: 'ELLIPSE', fills: [FILL] })
    expect(hit(graph, 50, -2)).toBeNull()
    expect(hit(graph, 50, -2, 3)).toBe(id)
    expect(hit(graph, 3, 3, 3)).toBeNull()
  })

  test('a rotated ellipse is hit in its own oval', () => {
    const graph = new SceneGraph()
    const id = shape(graph, {
      type: 'ELLIPSE',
      width: 200,
      height: 40,
      rotation: 90,
      fills: [FILL]
    })
    // Rotated about its center (100, 20), the 200×40 oval stands upright from y=-80 to y=120.
    expect(hit(graph, 100, 110)).toBe(id)
    expect(hit(graph, 190, 20)).toBeNull()
  })

  test('rounded corners exclude the square corner', () => {
    const graph = new SceneGraph()
    const id = shape(graph, { type: 'RECTANGLE', cornerRadius: 30, fills: [FILL] })
    expect(hit(graph, 2, 2)).toBeNull()
    expect(hit(graph, 15, 15)).toBe(id)
    expect(hit(graph, 50, 2)).toBe(id)
  })

  test('independent corner radii apply per corner', () => {
    const graph = new SceneGraph()
    const id = shape(graph, {
      type: 'RECTANGLE',
      independentCorners: true,
      topLeftRadius: 40,
      topRightRadius: 0,
      bottomRightRadius: 0,
      bottomLeftRadius: 0,
      fills: [FILL]
    })
    expect(hit(graph, 2, 2)).toBeNull()
    expect(hit(graph, 98, 2)).toBe(id)
  })

  test('a star is hit on its arms, not between them', () => {
    const graph = new SceneGraph()
    const id = shape(graph, { type: 'STAR', pointCount: 5, starInnerRadius: 0.38, fills: [FILL] })
    expect(hit(graph, 50, 50)).toBe(id)
    expect(hit(graph, 50, 4)).toBe(id)
    expect(hit(graph, 10, 10)).toBeNull()
  })

  test('a filled vector is hit inside its region and missed beside it', () => {
    const graph = new SceneGraph()
    const id = shape(graph, { type: 'VECTOR', vectorNetwork: TRIANGLE, fills: [FILL] })
    expect(hit(graph, 20, 20)).toBe(id)
    expect(hit(graph, 90, 90)).toBeNull()
  })

  test('a stroked open path is hit along its line only', () => {
    const graph = new SceneGraph()
    const id = shape(graph, { type: 'VECTOR', vectorNetwork: OPEN_L, strokes: [stroke(4)] })
    expect(hit(graph, 1, 50)).toBe(id)
    expect(hit(graph, 50, 99)).toBe(id)
    expect(hit(graph, 50, 50)).toBeNull()
    // A centered 4-unit stroke reaches 2 units; with 3 units of padding the band is 5 wide.
    expect(hit(graph, 50, 94, 3)).toBeNull()
    expect(hit(graph, 50, 95, 3)).toBe(id)
  })

  test('a curved segment is hit along the curve', () => {
    const graph = new SceneGraph()
    // A quarter arc from (0,100) to (100,0), bulging toward (0,0).
    const arc: VectorNetwork = {
      vertices: [
        { x: 0, y: 100 },
        { x: 100, y: 0 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: -55 }, tangentEnd: { x: -55, y: 0 } }
      ],
      regions: []
    }
    const id = shape(graph, { type: 'VECTOR', vectorNetwork: arc, strokes: [stroke(2)] })
    const t = 0.5
    const u = 1 - t
    const x = 3 * u * t * t * 45 + t * t * t * 100
    const y = u * u * u * 100 + 3 * u * u * t * 45
    expect(hit(graph, x, y, 1)).toBe(id)
    expect(hit(graph, 90, 90, 1)).toBeNull()
  })

  test('an unpainted ellipse still follows its oval, as its hover outline does', () => {
    const graph = new SceneGraph()
    const id = shape(graph, { type: 'ELLIPSE' })
    expect(hit(graph, 50, 50)).toBe(id)
    expect(hit(graph, 3, 3)).toBeNull()
  })

  test('layers whose box is their shape keep the box', () => {
    const graph = new SceneGraph()
    const unpainted = shape(graph, { type: 'VECTOR', vectorNetwork: OPEN_L })
    expect(hit(graph, 50, 50)).toBe(unpainted)

    const other = new SceneGraph()
    const partial = shape(other, {
      type: 'ELLIPSE',
      fills: [FILL],
      arcData: { startingAngle: 0, endingAngle: Math.PI, innerRadius: 0 }
    })
    expect(hit(other, 3, 3)).toBe(partial)
  })
})
