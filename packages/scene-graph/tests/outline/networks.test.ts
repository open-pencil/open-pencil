import { describe, expect, test } from 'bun:test'

import { contoursBlob, fill, setup, stroke } from '../helpers/outline'

describe('vector networks and saved geometry', () => {
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
})
