import { describe, expect, test } from 'bun:test'

import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'

import { curve, fill, PAD, setup, straight, stroke } from '../helpers/outline'

describe('a stroked shape without a fill', () => {
  test('is hit on its curve and within 3.5 px of the stroke band, not inside its box', () => {
    const { add, hits } = setup()
    const line = curve(add, [stroke(2)])
    expect(hits(line, 150, 0)).toBe(true)
    expect(hits(line, 150, 4)).toBe(true)
    expect(hits(line, 150, 6)).toBe(false)
    expect(hits(line, 150, 60)).toBe(false)
  })

  test('reaches 3.5 px past a thick stroke centred on an open path', () => {
    const { add, hits } = setup()
    const path = add('VECTOR', {
      width: 300,
      height: 0,
      strokes: [stroke(10)],
      vectorNetwork: straight(300)
    })
    expect(hits(path, 150, 8)).toBe(true)
    expect(hits(path, 150, 9)).toBe(false)
  })

  // Measured in Figma 126 on a line layer of weight 10 (scratch/pr-oracle/line-hit.ts): its stroke
  // runs a full weight to the line's negative y, and clicks hit from 13 px above to 3 px below.
  test('takes a line layer by the stroke a full weight to one side of it', () => {
    const { add, hits } = setup()
    const line = add('LINE', { width: 300, height: 0, strokeCap: 'NONE', strokes: [stroke(10)] })
    expect(hits(line, 150, -13)).toBe(true)
    expect(hits(line, 150, -14)).toBe(false)
    expect(hits(line, 150, 3)).toBe(true)
    expect(hits(line, 150, 4)).toBe(false)
    // Past its flat end, within the pad only.
    expect(hits(line, 303, -5)).toBe(true)
    expect(hits(line, 304, -5)).toBe(false)
  })

  test('scales its reach with the zoom, as the pad is screen pixels', () => {
    const { add, hits } = setup()
    const path = add('VECTOR', {
      width: 300,
      height: 0,
      strokes: [stroke(1)],
      vectorNetwork: straight(300)
    })
    // At 400% the 0.5 unit half stroke is 2 px, so 5 px out hits and 6 px misses.
    expect(hits(path, 150, 5 / 4, PAD / 4)).toBe(true)
    expect(hits(path, 150, 6 / 4, PAD / 4)).toBe(false)
  })

  test('is hit on a rectangle by its inside stroke, not in its middle', () => {
    const { add, hits } = setup()
    const box = add('RECTANGLE', {
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      strokes: [stroke(1, 'INSIDE')]
    })
    expect(hits(box, 100, 75)).toBe(false)
    expect(hits(box, 4, 75)).toBe(true)
    expect(hits(box, 5, 75)).toBe(false)
    expect(hits(box, -3, 75)).toBe(true)
    expect(hits(box, -4, 75)).toBe(false)
  })

  test('is missed inside a closed path', () => {
    const { add, hits } = setup()
    const triangle = add('VECTOR', {
      width: 200,
      height: 200,
      strokes: [stroke(2)],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 200 },
          { x: 200, y: 200 },
          { x: 100, y: 0 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
      }
    })
    expect(hits(triangle, 100, 150)).toBe(false)
    expect(hits(triangle, 50, 200)).toBe(true)
  })
})

describe('a filled shape', () => {
  test('is hit inside its outline, not in the corners of its box', () => {
    const { add, hits } = setup()
    const ellipse = add('ELLIPSE', { width: 200, height: 200, fills: [fill()] })
    expect(hits(ellipse, 100, 100)).toBe(true)
    expect(hits(ellipse, 5, 5)).toBe(false)
    expect(hits(ellipse, -3, 100)).toBe(true)
    expect(hits(ellipse, -4, 100)).toBe(false)

    const rounded = add('RECTANGLE', {
      x: 300,
      width: 200,
      height: 200,
      cornerRadius: 80,
      fills: [fill()]
    })
    expect(hits(rounded, 303, 3)).toBe(false)
    expect(hits(rounded, 298, 100)).toBe(true)
  })

  test('is missed in the hole of a boolean subtraction it draws without saved geometry', () => {
    const { graph, add, hits } = setup()
    const boolean = add('BOOLEAN_OPERATION', {
      width: 200,
      height: 200,
      booleanOperation: 'SUBTRACT',
      fills: [fill()]
    })
    graph.createNode('RECTANGLE', boolean.id, { width: 200, height: 200 })
    graph.createNode('RECTANGLE', boolean.id, { x: 50, y: 50, width: 100, height: 100 })
    expect(hits(boolean, 20, 20)).toBe(true)
    expect(hits(boolean, 100, 100)).toBe(false)
  })
})

describe('a boolean operation without saved geometry', () => {
  function emptySubtraction(paints: Partial<SceneNode>) {
    const { graph, add, hits } = setup()
    const boolean = add('BOOLEAN_OPERATION', {
      width: 200,
      height: 200,
      booleanOperation: 'SUBTRACT',
      ...paints
    })
    graph.createNode('RECTANGLE', boolean.id, { width: 200, height: 200 })
    graph.createNode('RECTANGLE', boolean.id, { width: 200, height: 200 })
    return { boolean, hits }
  }

  test('counts no edge of an operand its result does not draw, for a fill', () => {
    const { boolean, hits } = emptySubtraction({ fills: [fill()] })
    expect(hits(boolean, 100, 100)).toBe(false)
    expect(hits(boolean, 1, 100)).toBe(false)
    expect(hits(boolean, -2, 100)).toBe(false)
  })

  test('counts no edge of an operand its result does not draw, for a stroke', () => {
    const { boolean, hits } = emptySubtraction({ strokes: [stroke(4)] })
    expect(hits(boolean, 0, 100)).toBe(false)
  })

  test('reaches a result thinner than the pad', () => {
    const { graph, add, hits } = setup()
    const boolean = add('BOOLEAN_OPERATION', {
      width: 200,
      height: 200,
      booleanOperation: 'SUBTRACT',
      fills: [fill()]
    })
    graph.createNode('RECTANGLE', boolean.id, { width: 200, height: 200 })
    graph.createNode('RECTANGLE', boolean.id, { x: -10, width: 112.9, height: 200 })
    graph.createNode('RECTANGLE', boolean.id, { x: 103.2, width: 96.8, height: 200 })
    // The result is the strip from x 102.9 to 103.2, 2.9 units from the click.
    expect(hits(boolean, 100, 100)).toBe(true)
    expect(hits(boolean, 98, 100)).toBe(false)
  })

  test('reaches the edges its result draws', () => {
    const { graph, add, hits } = setup()
    const boolean = add('BOOLEAN_OPERATION', {
      width: 200,
      height: 200,
      booleanOperation: 'SUBTRACT',
      strokes: [stroke(2)]
    })
    graph.createNode('RECTANGLE', boolean.id, { width: 200, height: 200 })
    graph.createNode('RECTANGLE', boolean.id, { x: 50, y: 50, width: 100, height: 100 })
    expect(hits(boolean, 2, 100)).toBe(true)
    expect(hits(boolean, 52, 100)).toBe(true)
    expect(hits(boolean, 100, 100)).toBe(false)
  })
})

describe('which paints take clicks', () => {
  const cases: Array<[string, Partial<SceneNode>, boolean]> = [
    ['no paints', {}, false],
    ['a fill at 0% opacity', { fills: [fill({ opacity: 0 })] }, false],
    ['a hidden fill', { fills: [fill({ visible: false })] }, false],
    [
      'a gradient whose stops are all transparent',
      {
        fills: [
          fill({
            type: 'GRADIENT_LINEAR',
            gradientStops: [
              { position: 0, color: { r: 1, g: 0, b: 0, a: 0 } },
              { position: 1, color: { r: 0, g: 0, b: 1, a: 0 } }
            ]
          })
        ]
      },
      false
    ],
    ['a fill at 1% opacity', { fills: [fill({ opacity: 0.01 })] }, true],
    ['a showing fill on a layer at 0% opacity', { fills: [fill()], opacity: 0 }, true]
  ]
  test.each(cases)('%s', (_, props, hit) => {
    const { add, hits } = setup()
    const box = add('RECTANGLE', { width: 200, height: 150, ...props })
    expect(hits(box, 100, 75)).toBe(hit)
  })

  test('a stroke at 0% opacity is missed on its edge', () => {
    const { add, hits } = setup()
    const box = add('RECTANGLE', {
      width: 200,
      height: 150,
      strokes: [stroke(1, 'INSIDE', { opacity: 0 })]
    })
    expect(hits(box, 0, 75)).toBe(false)
  })
})

test('a rotated line is hit where it draws, not where it would lie unrotated', () => {
  const { graph, add, hits } = setup()
  const line = add('LINE', {
    x: 100,
    y: 100,
    width: 200,
    height: 0,
    rotation: 90,
    strokes: [stroke(1)]
  })
  const drawn = getAxisAlignedWorldBounds(line, graph)
  // Turned a quarter, the line stands upright: its world box is a vertical sliver.
  expect(drawn.width).toBeLessThan(1)
  expect(drawn.height).toBeCloseTo(200, 6)
  expect(hits(line, drawn.x, drawn.y + 100)).toBe(true)
  expect(hits(line, 200, 100)).toBe(false)
})

describe('outline details', () => {
  test('a sloped line is hit along the diagonal it draws', () => {
    const { add, hits } = setup()
    const line = add('LINE', { width: 100, height: 100, strokes: [stroke(1)] })
    expect(hits(line, 50, 50)).toBe(true)
    expect(hits(line, 50, 0)).toBe(false)
  })

  test("a huge ellipse's edge stays within the pad at the maximum zoom", () => {
    const { add, hits } = setup()
    const radius = 50_000
    const ellipse = add('ELLIPSE', { width: radius * 2, height: radius * 2, fills: [fill()] })
    const pad = PAD / 256
    // Just inside the rim, midway along the first chord of a 1,024-step polygon, which cuts the
    // rim there by about 0.24 units, far more than the 0.014-unit pad.
    const angle = Math.PI / 1024
    const r = radius - pad / 2
    expect(hits(ellipse, radius + r * Math.cos(angle), radius + r * Math.sin(angle), pad)).toBe(
      true
    )
  })
})

test('text is left to its box', () => {
  const { add, hits } = setup()
  const text = add('TEXT', { width: 100, height: 20, text: 'Label' })
  expect(hits(text, 50, 10)).toBeNull()
})
