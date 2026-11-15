import { describe, expect, test } from 'bun:test'

import { setup, straight, stroke } from '../helpers/outline'

describe('line ends and arrow heads', () => {
  test('a flat cap ends an open path at its end; a round one paints past it', () => {
    const { add, hits } = setup()
    const flat = add('VECTOR', {
      width: 100,
      height: 0,
      strokeCap: 'NONE',
      strokes: [stroke(20)],
      vectorNetwork: straight(100)
    })
    // 8 units past the end, on the path's axis.
    expect(hits(flat, 108, 0)).toBe(false)
    expect(hits(flat, 103, 0)).toBe(true)
    const round = add('VECTOR', {
      width: 100,
      height: 0,
      strokeCap: 'ROUND',
      strokes: [stroke(20)],
      vectorNetwork: straight(100)
    })
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

  test('past a flat end the reach is measured from the painted corner', () => {
    const { add, hits } = setup()
    const path = add('VECTOR', {
      width: 100,
      height: 0,
      strokeCap: 'NONE',
      strokes: [stroke(20)],
      vectorNetwork: straight(100)
    })
    // 4.24 units from the corner (100, 10): beyond the 3.5 pad.
    expect(hits(path, 103, 13)).toBe(false)
    expect(hits(path, 102, 11)).toBe(true)
  })
})
