import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill, type SceneNode, type Stroke } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'
import { hitsShape } from '@open-pencil/scene-graph/outline'

// Measured in Figma 126.6.12 with real clicks (scratch/pr-oracle/stroke-hit*.ts): a click selects a
// shape inside the area a showing fill covers or on the band a showing stroke draws, either grown
// by 3.5 screen pixels, and a shape whose paints show nothing is never selected by a click.
const PAD = 3.5

const fill = (overrides: Partial<Fill> = {}): Fill => ({
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  ...overrides
})

const stroke = (weight: number, align: Stroke['align'] = 'CENTER', overrides: Partial<Stroke> = {}): Stroke => ({
  ...fill({ color: { r: 0, g: 0, b: 0, a: 1 } }),
  weight,
  align,
  ...overrides
})

/** A Figma geometry blob for straight contours, each closed. */
function contoursBlob(contours: Array<Array<[number, number]>>): Uint8Array {
  const size = contours.reduce((sum, contour) => sum + contour.length * 9 + 1, 0)
  const blob = new Uint8Array(size)
  const view = new DataView(blob.buffer)
  let offset = 0
  for (const contour of contours) {
    for (const [index, [x, y]] of contour.entries()) {
      blob[offset++] = index === 0 ? 1 : 2
      view.setFloat32(offset, x, true)
      view.setFloat32(offset + 4, y, true)
      offset += 8
    }
    blob[offset++] = 0
  }
  return blob
}

/** An open path along the x axis from 0 to `length`. */
function straight(length: number) {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: length, y: 0 }
    ],
    segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    regions: []
  }
}

function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const add = (type: SceneNode['type'], props: Partial<SceneNode>) => graph.createNode(type, page, props)
  const hits = (node: SceneNode, x: number, y: number, pad = PAD) => hitsShape(graph, node, x, y, pad)
  return { graph, add, hits }
}

/** An open curve from (0, 75) to (300, 75) bowing up to its apex at (150, 0). */
function curve(add: ReturnType<typeof setup>['add'], strokes: Stroke[], fills: Fill[] = []) {
  return add('VECTOR', {
    width: 300,
    height: 75,
    fills,
    strokes,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 75 },
        { x: 300, y: 75 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 100, y: -100 }, tangentEnd: { x: -100, y: -100 } }
      ],
      regions: []
    }
  })
}

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
    const path = add('VECTOR', { width: 300, height: 0, strokes: [stroke(10)], vectorNetwork: straight(300) })
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
    const path = add('VECTOR', { width: 300, height: 0, strokes: [stroke(1)], vectorNetwork: straight(300) })
    // At 400% the 0.5 unit half stroke is 2 px, so 5 px out hits and 6 px misses.
    expect(hits(path, 150, 5 / 4, PAD / 4)).toBe(true)
    expect(hits(path, 150, 6 / 4, PAD / 4)).toBe(false)
  })

  test('is hit on a rectangle by its inside stroke, not in its middle', () => {
    const { add, hits } = setup()
    const box = add('RECTANGLE', { x: 0, y: 0, width: 200, height: 150, strokes: [stroke(1, 'INSIDE')] })
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

    const rounded = add('RECTANGLE', { x: 300, width: 200, height: 200, cornerRadius: 80, fills: [fill()] })
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

  test("reaches the edges its result draws", () => {
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
    const box = add('RECTANGLE', { width: 200, height: 150, strokes: [stroke(1, 'INSIDE', { opacity: 0 })] })
    expect(hits(box, 0, 75)).toBe(false)
  })
})

test('a rotated line is hit where it draws, not where it would lie unrotated', () => {
  const { graph, add, hits } = setup()
  const line = add('LINE', { x: 100, y: 100, width: 200, height: 0, rotation: 90, strokes: [stroke(1)] })
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

  test('each side of a rectangle with independent borders reaches by its own weight', () => {
    const { add, hits } = setup()
    const box = add('RECTANGLE', {
      width: 200,
      height: 150,
      strokes: [stroke(1, 'INSIDE')],
      independentStrokeWeights: true,
      borderTopWeight: 20,
      borderRightWeight: 1,
      borderBottomWeight: 1,
      borderLeftWeight: 1
    })
    // 15 units in from the thick top border is on it; 15 in from the thin left one is not.
    expect(hits(box, 100, 15)).toBe(true)
    expect(hits(box, 15, 75)).toBe(false)
  })

  test("a fill's pad follows the filled area, not a stray open segment", () => {
    const { add, hits } = setup()
    const shape = add('VECTOR', {
      width: 300,
      height: 100,
      fills: [fill()],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 300, y: 50 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
      }
    })
    expect(hits(shape, 80, 20)).toBe(true)
    // On the unstroked open segment, far from the triangle.
    expect(hits(shape, 200, 75)).toBe(false)
  })

  test('a loop naming a negative segment index adds no geometry', () => {
    const { add, hits } = setup()
    const shape = add('VECTOR', {
      width: 100,
      height: 100,
      fills: [fill()],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1, -1]] }]
      }
    })
    // Without the stray index the loop is the triangle (0,0)–(100,0)–(100,100), closed back.
    expect(hits(shape, 80, 20)).toBe(true)
    expect(hits(shape, 20, 80)).toBe(false)
  })

  test('a loop naming a fractional segment index adds no geometry', () => {
    const { add, hits } = setup()
    const shape = add('VECTOR', {
      width: 100,
      height: 100,
      fills: [fill()],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: [{ windingRule: 'NONZERO', loops: [[0.5, 1]] }]
      }
    })
    // Read as segment 0, the stray index would close a triangle over (80, 20).
    expect(hits(shape, 80, 20)).toBe(false)
  })

  test('an open network centres its stroke even when its fill geometry is saved', () => {
    const { add, hits } = setup()
    const blob = new Uint8Array(1 + 8 + 1 + 8 + 1 + 8 + 1)
    const view = new DataView(blob.buffer)
    let offset = 0
    const command = (code: number, ...points: number[]) => {
      blob[offset++] = code
      for (const value of points) {
        view.setFloat32(offset, value, true)
        offset += 4
      }
    }
    command(1, 0, 0)
    command(2, 100, 0)
    command(2, 100, 100)
    command(0)
    const shape = add('VECTOR', {
      width: 100,
      height: 100,
      strokes: [stroke(10, 'INSIDE')],
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: blob }],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })
    // 4 units outside the top segment lies on its centred 10-unit band.
    expect(hits(shape, 50, -4)).toBe(true)
  })

  test('independent borders follow rounded corners', () => {
    const { add, hits } = setup()
    const box = add('RECTANGLE', {
      width: 100,
      height: 100,
      cornerRadius: 50,
      strokes: [stroke(1, 'INSIDE')],
      independentStrokeWeights: true,
      borderTopWeight: 10,
      borderRightWeight: 1,
      borderBottomWeight: 1,
      borderLeftWeight: 1
    })
    // 5 units in from the rounded corner lies on the 10-unit top border drawn round it.
    expect(hits(box, 18.2, 18.2)).toBe(true)
    // The square corner outside the curve is empty.
    expect(hits(box, 1, 1)).toBe(false)
  })

  test('a flat cap ends an open path at its end; a round one paints past it', () => {
    const { add, hits } = setup()
    const flat = add('VECTOR', { width: 100, height: 0, strokeCap: 'NONE', strokes: [stroke(20)], vectorNetwork: straight(100) })
    // 8 units past the end, on the path's axis.
    expect(hits(flat, 108, 0)).toBe(false)
    expect(hits(flat, 103, 0)).toBe(true)
    const round = add('VECTOR', { width: 100, height: 0, strokeCap: 'ROUND', strokes: [stroke(20)], vectorNetwork: straight(100) })
    expect(hits(round, 108, 0)).toBe(true)
  })

  test('an arrow head on a line layer takes clicks across its full width', () => {
    const { add, hits } = setup()
    const arrow = add('LINE', {
      width: 200,
      height: 0,
      strokeCap: 'TRIANGLE_FILLED',
      strokes: [stroke(4)]
    })
    // The head spreads about 11.5 units either side of the shaft at its base, here 10 below it.
    expect(hits(arrow, 197, 8)).toBe(true)
    expect(hits(arrow, 197, 14)).toBe(false)
    // The shaft alone reaches no further than its band and the pad.
    expect(hits(arrow, 100, 8)).toBe(false)
  })

  test("a line arrow's wings take clicks on an open path", () => {
    const { add, hits } = setup()
    const path = add('VECTOR', {
      width: 200,
      height: 0,
      strokeCap: 'ARROW_LINES',
      strokes: [stroke(2)],
      vectorNetwork: straight(200)
    })
    // Beside the lower wing, which runs 9 units back from the tip at 45°: off the shaft's reach.
    expect(hits(path, 194.5, 5.8)).toBe(true)
    expect(hits(path, 188, 10)).toBe(false)
  })

  test("a line's caps end where the line does", () => {
    const { add, hits } = setup()
    const round = add('LINE', { width: 100, height: 0, strokeCap: 'ROUND', strokes: [stroke(20)] })
    // The cap is drawn inside the line's length, so 8 past the end is beyond the pad.
    expect(hits(round, 108, -10)).toBe(false)
    expect(hits(round, 103, -10)).toBe(true)
  })

  test('a closed network without regions keeps its stroke alignment when stroke geometry is saved', () => {
    const { add, hits } = setup()
    const network = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    }
    const saved = add('VECTOR', {
      width: 100,
      height: 100,
      strokes: [stroke(10, 'INSIDE')],
      strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: new Uint8Array([0]) }],
      vectorNetwork: network
    })
    // 4.5 units outside the top edge: an inside stroke draws nothing there.
    expect(hits(saved, 50, -4.5)).toBe(false)
    const drawnCentred = add('VECTOR', {
      width: 100,
      height: 100,
      strokes: [stroke(10, 'INSIDE')],
      vectorNetwork: network
    })
    expect(hits(drawnCentred, 50, -4.5)).toBe(true)
  })

  test('loops that cancel under even-odd fill take no clicks on their shared edge', () => {
    const { add, hits } = setup()
    const square: Array<[number, number]> = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100]
    ]
    const shape = add('VECTOR', {
      width: 100,
      height: 100,
      fills: [fill()],
      fillGeometry: [{ windingRule: 'EVENODD', commandsBlob: contoursBlob([square, square]) }]
    })
    expect(hits(shape, 50, 50)).toBe(false)
    expect(hits(shape, 50, 1)).toBe(false)
  })

  test('a side with no border weight takes no clicks', () => {
    const { add, hits } = setup()
    const box = add('RECTANGLE', {
      width: 200,
      height: 150,
      strokes: [stroke(1, 'INSIDE')],
      independentStrokeWeights: true,
      borderTopWeight: 4,
      borderRightWeight: 0,
      borderBottomWeight: 4,
      borderLeftWeight: 4
    })
    expect(hits(box, 199, 75)).toBe(false)
    expect(hits(box, 1, 75)).toBe(true)
  })

  test('past a flat end the reach is measured from the painted corner', () => {
    const { add, hits } = setup()
    const path = add('VECTOR', { width: 100, height: 0, strokeCap: 'NONE', strokes: [stroke(20)], vectorNetwork: straight(100) })
    // 4.24 units from the corner (100, 10): beyond the 3.5 pad.
    expect(hits(path, 103, 13)).toBe(false)
    expect(hits(path, 102, 11)).toBe(true)
  })

  test('without a network or fill geometry a stroke is still hit on its saved outline only', () => {
    const { add, hits } = setup()
    const band: Array<[number, number]> = [
      [0, -2],
      [100, -2],
      [100, 2],
      [0, 2]
    ]
    const strokeOnly = add('VECTOR', {
      width: 100,
      height: 100,
      strokes: [stroke(4)],
      strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: contoursBlob([band]) }]
    })
    expect(hits(strokeOnly, 50, 0)).toBe(true)
    // In the layer's empty box, away from the painted stroke.
    expect(hits(strokeOnly, 50, 60)).toBe(false)
  })

  test('without a network a stroke is hit on its saved stroke outline only', () => {
    const { add, hits } = setup()
    const triangle: Array<[number, number]> = [
      [0, 0],
      [100, 0],
      [100, 100]
    ]
    // The stroke outline: a 4-unit band along the top edge only.
    const band: Array<[number, number]> = [
      [0, -2],
      [100, -2],
      [100, 2],
      [0, 2]
    ]
    const withOutline = add('VECTOR', {
      width: 100,
      height: 100,
      strokes: [stroke(4)],
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: contoursBlob([triangle]) }],
      strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: contoursBlob([band]) }]
    })
    expect(hits(withOutline, 50, 0)).toBe(true)
    // On the triangle's closing edge, which no stroke draws.
    expect(hits(withOutline, 50, 50)).toBe(false)
    const withoutOutline = add('VECTOR', {
      width: 100,
      height: 100,
      strokes: [stroke(4)],
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: contoursBlob([triangle]) }]
    })
    expect(hits(withoutOutline, 50, 0)).toBe(false)
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
    expect(hits(ellipse, radius + r * Math.cos(angle), radius + r * Math.sin(angle), pad)).toBe(true)
  })
})

test('text is left to its box', () => {
  const { add, hits } = setup()
  const text = add('TEXT', { width: 100, height: 20, text: 'Label' })
  expect(hits(text, 50, 10)).toBeNull()
})
